# UPGRADE_PLAN — Multi-Sensor Expert Architecture

Goal: present Palm Guard as a **multi-sensor expert architecture**, not one black-box
model — without changing the proven risk math or the safety-tested dose path.

## Key design decision (why this is safe)
The existing pipeline (`services/riskScore.js` → `sa, sv, st, svoc, risk_score`,
`services/doseEngine.js` caps, 19 safety tests) is **left intact**. The expert
layer is a **derivation + explanation layer** on top of the already-computed
`scored` object + raw reading + device status. It adds explainability, a sensor-
health gate, confidence, and a human-readable recommendation — it does **not**
recompute risk or change dosing. So all 19 safety tests stay valid.

## Mapping (suggested name → actual repo path)
| Spec module | Implemented as | Source it derives from |
|---|---|---|
| Acoustic Activity Expert | `services/experts/acousticExpert.js` | `scored.sa` (=100·p_activity) + `ac` features |
| Vibration Validation Expert | `services/experts/vibrationExpert.js` | `scored.sv` + `vb` |
| Environmental Context Expert | `services/experts/environmentExpert.js` | `scored.st`, `scored.svoc` + `th/env` |
| Sensor Health Expert | `services/experts/sensorHealthExpert.js` | raw reading + device status (NEW) |
| Risk Fusion Engine | `services/engines/riskFusionEngine.js` | mirrors `scored.risk_score` + expert outputs |
| Safety Dose Agent | `services/engines/doseSafetyEngine.js` | wraps `doseEngine` caps (read-only) |
| Explanation Agent | `services/experts/explanationExpert.js` | fusion + safety |
| Orchestrator + cache | `services/intelligence.js` | runs all of the above per reading |

Experts are **pure, deterministic, dependency-free** functions (easy to unit-test).
The orchestrator runs in `ingest.js` after scoring and emits new events.

## Phases
1. ✅ Inspect repo, write this plan.
2. Backend experts + engines + orchestrator (additive).
3. Wire into `ingest.js`; add socket events `risk:fusion`, `agents:update`; add
   read-only REST `GET /api/v1/intelligence[/:deviceId]` (served from a per-device
   cache so a GET never mutates baselines).
4. Frontend "Intelligence Layer" page: risk hero, 4 expert cards, decision flow,
   explanation panel, safety panel.
5. ML serve: add honesty fields (`model_family`, `validation_status`,
   `claim_guardrail`) to `/health` + `/score` — no new heavy deps.
6. Firmware: add `PG_FEATURE_VERSION` (single source of truth) + payload mapping
   comments. No rewrite, no safety change.
7. Tests: new Node unit tests for experts/fusion (range, env-never-triggers-dose,
   sensor-health gate, risk 0–100, high-acoustic+vibration, resample on bad
   health). Existing 19 Python safety tests untouched.
8. Docs: README architecture section + Mermaid + capability-vs-roadmap + the
   judge spoken paragraph.
9. Build + tests green; backwards-compatible payloads.

## Honesty guardrails (enforced in copy)
- No "validated RPW detection accuracy" / no field-proven biology claims.
- Acoustic wording: "acoustic activity", "feeding-like acoustic activity"
  (only at high score), "proxy", "risk indicator" — never "RPW detected".
- Environment is **context only** — never "gas/temp proves infestation".
- Dosing stays human-armed + human-confirmed, server+device capped, nonce-
  protected; demo = clear water only.
