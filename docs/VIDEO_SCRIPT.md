# Palm Guard — 90-second video script (WRCC 2026 final)

Target **90 s**. Voiceover ≈ 167 words (~1.9 words/s — unrushed). Built from
[`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md); every shot is something that actually
exists. **Honesty rules on screen:** keep the **DEMO** badge visible; say
"acoustic activity / proxy", never "RPW detected" or an accuracy %; the dose is
human-confirmed and **clear water only**.

## Storyboard (time · on-screen · voiceover)

| Time | On-screen (visual) | Voiceover |
|---|---|---|
| **0:00–0:08** | Cold open: a wilting palm / before-after image, then the node render. | "Red Palm Weevil destroys date palms from the inside — by the time the crown wilts, the tree is gone." |
| **0:08–0:20** | Device render → Mission Overview map (16 nodes, 1 red / 2 amber / rest green). | "Palm Guard is a solar, per-tree node that listens inside the trunk — fusing sound, vibration, temperature and air-quality on an ESP32-S3." |
| **0:20–0:38** | **Intelligence Layer** page: risk hero + the four expert cards + the decision-flow strip. | "It's not a black box. Four expert models — acoustic activity as the primary signal, vibration confirming it, environment as context, and a sensor-health gate — feed one fusion engine that scores risk and explains itself." |
| **0:38–0:58** | **Tree Stethoscope**: run `tools/demo_event.sh PG-DEMO-105 15`; feeding band lights up, risk climbs, a HIGH-RISK alert card appears. | "Watch a healthy node go critical: feeding-like acoustic activity rises, the fused risk crosses threshold, and an alert fires." |
| **0:58–1:15** | The **Confirm Controlled Dose** modal + the Intelligence Layer **safety panel** (armed · human-confirm · caps · nonce · CLEAR WATER ONLY); click Confirm → dose `pending→sent→done`. | "Detection is autonomous — but the irreversible step is not. Nothing doses unless a human arms the node and confirms. Hard caps on both the server and the device, an anti-replay nonce, and clear water only in this demo." |
| **1:15–1:30** | Model caveat badge / Evidence Locker export; end card: Palm Guard logo + "Team VCoders". | "We're honest about limits: today the model is proxy-validated, shown as a probability, never a fake accuracy number — and here's our path to real field validation. Palm Guard, by Team VCoders." |

## Capture checklist (before recording)
1. Pre-flight per `DEMO_RUNBOOK.md` §0 (ML :8001, backend :4000, `npm run seed:farm`, dashboard :5173). Confirm the **DEMO** badge.
2. Screen-record at 1920×1080, 30 fps. Use **PG-DEMO-105** as the node you drive live; **PG-DEMO-101** is the pre-red node for the map shot.
3. For 0:38–0:58, trigger `tools/demo_event.sh PG-DEMO-105 15` and start recording ~2 s before the risk climbs.
4. Between takes, clear cooldown: `curl -s -X PATCH localhost:4000/api/v1/devices/PG-DEMO-105/policy -H 'Content-Type: application/json' -d '{"cooldown_s":0}'`.
5. If you have a flashed node, cut 1–2 s of B-roll of the real pump pulsing clear water (failsafes visible) into 0:58–1:15 — that's the single biggest "paper robot → working robot" upgrade.

## B-roll / cutaways
- Landing-page hero + the live spectrogram scrolling.
- The decision-flow strip (Sensors → Experts → Fusion → Safety → Human Confirm → Capped Demo Dose).
- A quick pan of the safety panel rows.

## Two-sentence fallback close (if you prefer narration over the end card)
> "Today the acoustic model is a transparent proxy — we show a probability with a
> 'proxy' badge, never an accuracy number. The dose is always human-armed and
> confirmed, hard-capped on both the server and the device — and here's our exact
> path to field-validate on real RPW."

## On-screen lower-thirds (optional captions)
- 0:20 — "Multi-sensor expert architecture — not a single black-box model"
- 0:58 — "Human-confirmed · server + device caps · anti-replay nonce · clear water (demo)"
- 1:15 — "Proxy-validated, not field-validated — roadmap to field trials"
