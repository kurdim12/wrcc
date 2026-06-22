# Palm Guard — Booth Plan (WRCC 2026, Baku)

**Scored line:** Presentation & Project booth — **25 pts** (the second-biggest
single criterion). This doc fully specifies the booth so it can be built and
judged-ready before the team arrives at the table.

## The one rule that drives the whole design
**Make it read as a ROBOT, not a dashboard.** A judge walking by must see a
**physical node clamped to a palm trunk that detects and then physically doses
(clear water)** — the screen is secondary. The actuator (pump + line + reservoir)
is the centerpiece on the table, front-and-center. Everything else supports that.

## Rulebook constraints (design within these)
- Booth footprint **2 × 2 × 2 m**; table **120 × 60 cm** (§5.4–5.7).
- **All demo within the booth footprint**; **live-ready before judges arrive**.
- Liquid demo: **≤ 1 L clear water only**, **no pesticide**, no fire/smoke (§5.8).
- Bring **≥ 2 printed report copies** (§6.4) + printed posters.
- Have an **offline/video fallback** ready (§7.5) — never depend on venue WiFi.

## Top-view layout (2 × 2 m)

```
            ┌─────────────── BACK WALL (HERO) ───────────────┐
            │  LOGO + SLOGAN: "Hear the weevil before the    │
            │  palm falls."  ·  big system-architecture +     │
            │  detect→decide→act loop  ·  hero photo of node  │
   LEFT     │                                                 │   RIGHT
   WALL  →  │                                                 │  ← WALL
 (Research  │     ┌──────────── TABLE 120×60 ───────────┐     │ (Team /
  & Eng.)   │     │  LIVE NODE on palm-log + PUMP +      │     │  Impact /
            │     │  clear-water reservoir + delivery    │     │  Business)
            │     │  line  |  small monitor (live dash)  │     │
            │     │  |  ARM→CONFIRM→DOSE placard  |  ×2  │     │
            │     │  printed reports  |  QR (repo/video) │     │
            │     └──────────────────────────────────────┘     │
            └──────────────── OPEN FRONT (judges) ────────────┘
```

## Table — the live "robot" station (front-center)
1. **The node** (ESP32-S3 + INMP441 + MPU6050 + DS18B20 + BME680 + NeoPixel)
   **mounted/clamped to a ~30–40 cm section of palm trunk or hardwood log** so the
   acoustic coupling and "inside the trunk" story are physical, not abstract.
2. **The actuator, plumbed and visible:** the metered pump → clear-tubing →
   **≤ 1 L clear-water reservoir** → a small catch tray on the log. Judges must
   *see the dose happen*. Label the reservoir **"CLEAR WATER ONLY — DEMO."**
3. **Small monitor / laptop** showing the **Intelligence Layer** page (risk hero +
   experts + safety panel) and the **Tree Stethoscope** spectrogram — secondary to
   the node, angled so a judge glances between log and screen.
4. **Safety placard** (A5, standing): `ARM → CONFIRM → DOSE` with the dual
   server+device caps + nonce + clear-water note. This is your autonomy/ethics
   answer made physical.
5. **2 printed report copies**, a **QR code** to the repo + 90-s video, business cards.

## Wall-by-wall content + visual hierarchy

> **Three read-distances:** (1) **3 m / 3 s** — slogan + hero image + one value
> line; (2) **1 m / 30 s** — the loop diagram + 3 headline facts; (3) **at the
> table / 3 min** — detailed panels. Big fonts, high contrast, the
> forest-green/gold/off-white palette, **minimal text per panel, visuals lead.**

### Back wall — HERO (Idea + Robotic Solution)
- **Top band:** logo + **slogan** "Hear the weevil before the palm falls." +
  "WRCC 2026 · Theme 1 — Agriculture."
- **Center:** large **detect → decide → act** loop and the **system-architecture**
  diagram (`system-architecture.png`) + a **hero photo of the node on a palm**
  (`device-render.png`).
- **One value line:** "A solar per-tree node that hears RPW activity and delivers
  a human-confirmed, targeted micro-dose — instead of spraying the whole farm."

### Left wall — RESEARCH & ENGINEERING (Research/Report + Technical Understanding)
- **The problem:** RPW feeds inside the trunk; visual inspection is too late
  (with one sourced stat `[FILL: cite]`).
- **Prior art & differentiation:** detect-only / contact-probe / handheld vs.
  **our autonomous, per-tree detect→targeted-dose** (the "isn't this already
  done?" answer).
- **Multi-sensor expert architecture** diagram (acoustic primary → vibration →
  environment → sensor-health → fusion → safety) — the "not a black box" panel.
- **Honesty strip:** "proxy risk indicator, not validated RPW accuracy; we show a
  probability with a proxy badge, never an accuracy number" — turn honesty into a
  visible strength.
- Small **development-process** strip (timeline: idea → firmware → backend/ML →
  dashboard → tests/CI).

### Right wall — TEAM · IMPACT · BUSINESS (Team Spirit + Social Impact + Entrepreneurship)
- **Team photo + names + roles** (VCoders) + coach.
- **Social impact + negative effects** (the honest risks + mitigations table —
  plays to your strength).
- **Business Model Canvas** (large, legible — the filled `Palm_Guard_BMC_A4.pdf`).
- **Roadmap** (prototype → bench → proxy model → field pilot) + the **safety
  model** (ARM/CONFIRM/caps/nonce/clear-water).

## Live demo choreography (at the booth, ≈3–5 min)
Follow [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md):
1. Hook at the **log**: "This node is listening inside the trunk."
2. On the monitor, drive the event (`tools/demo_event.sh PG-DEMO-105 15`): risk
   climbs on the Intelligence Layer; explain acoustic-primary + vibration-confirm.
3. **Arm** → **Confirm** → the **pump pulses clear water** on the log — the robot
   acts. Point to the safety placard: "dual caps + nonce + human-confirm."
4. Show the **dose history** + the honesty close ("proxy today; here's our field-
   validation path").
- **Autonomy variant:** if the node is flashed with `PG_ONBOARD_AUTONOMY`, show
  the node deciding on-device with the server unplugged from control. *(Only claim
  this if it's actually flashed + bench-validated — otherwise demo the framing.)*

## Fallbacks (§7.5) — rehearse these
- **No WiFi:** the backend + dashboard run **locally** (localhost); the demo needs
  no internet. Bring a local router/hotspot only if needed.
- **Capture flaky / pump issue:** play the **90-s video** (on the monitor, offline
  file) showing the node acting; keep narrating.
- **One panel/page glitches:** the dashboard ErrorBoundary keeps the rest live.

## Power & logistics (Baku)
- Mains **220 V, plug type C/F** — bring **type C/F adapters** + a power strip.
- **Spares:** a duplicate node + sensors + pump + cables + USB power; extra clear
  water; tape, zip-ties, multi-tool, spare SD/USB with the video + a dashboard build.
- Charge laptop/monitor; bring a battery bank for the node.

## Print & build checklist
- [ ] 3 wall panels (foam-board or roll-up banners) — back/left/right per above.
- [ ] Hero node photo (large), architecture diagram, expert-architecture diagram,
      BMC (large), team photo, safety placard (A5 standing), honesty strip.
- [ ] QR codes: repo + 90-s video.
- [ ] **≥ 2 printed report copies** (§6.4).
- [ ] Physical: node on palm-log mount, pump + tubing + ≤1 L clear-water reservoir
      + catch tray, monitor/laptop, cables, power strip, adapters, spares.
- [ ] Offline copies: dashboard build, video file, demo DB seeded.

## Team roles at the booth (Team Spirit — all in English)
| Role | Primary | Backup |
|---|---|---|
| Pitch / story (3 m read) | `[member A]` | `[member B]` |
| Live demo driver (node + dashboard) | `[member B]` | `[member C]` |
| Q&A / technical + business | `[member C]` | `[member A]` |
Rehearse the **5-min pitch + 5-min Q&A** from [`JUDGE_QA.md`](JUDGE_QA.md);
every member must be able to do every role.

## Pre-judging setup checklist (run on arrival)
- [ ] Walls mounted within the 2×2 footprint; table set; everything inside the box.
- [ ] Node powered, clamped to log; pump primed with **clear water**; catch tray placed.
- [ ] Backend + dashboard live locally; demo event tested once; cooldown reset.
- [ ] Video file + printed reports on the table; QR codes reachable.
- [ ] Slogan + hero visible from 3 m; safety placard facing the judges.
- [ ] Roles assigned; one dry-run of the 3–5 min demo before judging.
