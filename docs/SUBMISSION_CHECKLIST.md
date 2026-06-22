# Palm Guard — WRCC 2026 Submission: What's Left (Master Action Plan)

*Status as of this handoff. Everything software/docs is committed on `main`.
This is the remaining work to a complete, honest submission.* Legend: **P0** =
critical path (submission/scoring depends on it) · **P1** = important · **P2** =
polish. **Owner: You** = team/hardware/logistics · **Owner: Agent** = I can do it
on request (doc/code).

---

## ✅ Already done (on `main`, verified)
- **Software complete & green:** backend + multi-sensor expert architecture +
  Intelligence Layer dashboard; **29 automated tests pass** (19 safety + 10
  expert); CI green; frontend builds.
- **Firmware code complete** incl. the **on-device autonomy** module
  (`PG_ONBOARD_AUTONOMY`, default-off, decision logic **host-compiled + unit-
  tested**). *Not yet flashed.*
- **LLM chat assistant removed** (no LLM in the solution/control path).
- **Docs:** §6.5-structured project report (draft), `JUDGE_QA`, `BOOTH_PLAN`,
  `VIDEO_SCRIPT`, `TRAIN_ON_MY_MACHINE`, `BENCH_BRINGUP`, `DEMO_RUNBOOK`,
  `RUN_ON_WINDOWS`, `CLAIMS_AUDIT`, `BUILD_LOG`, slogan + Theme 1.
- **BMC** drafted (`Palm_Guard_BMC_A4.pdf`) — needs 3 small reword fixes (below).

---

## 🔴 Critical path (do these first, in this order)

### 1. Flash + bench-validate the node — **P0 · You**
The autonomy claim is only *real* once flashed and validated; until then you're on
the framing fallback. Follow [`docs/BENCH_BRINGUP.md`](BENCH_BRINGUP.md).
- [ ] Flash the ESP32-S3 (default build first).
- [ ] Enable `PG_ONBOARD_AUTONOMY=1`, re-flash, confirm the node decides + requests
      a dose **on-device** with the server unplugged from control.
- [ ] Verify the safety failsafes physically (arm/disarm, cooldown, daily cap,
      pump-ms ceiling, nonce) — pump runs **clear water only**.
- **Done when:** the node detects → decides → doses clear water on the bench,
  failsafes confirmed.

### 2. Record the 90-second video — **P0 · You**
Follow [`docs/VIDEO_SCRIPT.md`](VIDEO_SCRIPT.md). **Clear water only, ≤ 1 L**
(rule §5.8). Must show the **robot physically acting**, not just a dashboard.
- [ ] Capture detect → arm → confirm → dose (and the autonomy variant if flashed).
- [ ] Export, keep within the platform's length/size limits; have an offline copy.
- **Done when:** the video shows the node acting and is uploaded per the rules.

### 3. Train the proxy model — **P0 · You (Agent-drivable on your box)**
Follow [`docs/TRAIN_ON_MY_MACHINE.md`](TRAIN_ON_MY_MACHINE.md) (clone → data →
train → fill model_card). Produces **proxy** metrics, never "RPW accuracy."
- [ ] Create the Kaggle token (`kaggle.json`) — only you can do this.
- [ ] Run the pipeline; fill `ml/model_card.md` from real `metrics.json`.
- [ ] Update report §3.7/§4 + `CLAIMS_AUDIT.md` to the proxy reality.
- **Done when:** a trained proxy model + honest metrics exist and the card is filled.

---

## 📄 Report & written deliverables — **P0/P1 · You (Agent helps)**

### 4. Report title-page fills — **P0 · You**
In [`docs/PROJECT_REPORT.md`](PROJECT_REPORT.md): institution/school, submission
date, repo URL, **team photo**. (Project = Palm Guard, country = Jordan, team =
VCoders already in.)

### 5. Prior-art citations — **P0 · You**
Replace the `[FILL: cite]` markers with **real references**: RPW economic impact
(FAO/national), **Mankin et al.** acoustic RPW detection, a commercial acoustic
probe, ASPID, ESC-50 (Piczak 2015), InsectSound1000 (DOI in file). References is a
required §6.5 section — placeholders read as hollow.

### 6. Export report to PDF + verify page count — **P0 · You**
Export with **diagrams rendered** (your real toolchain, **not** pandoc — it skips
Mermaid and undercounts). **Confirm ≤ 20 single-sided pages with a margin** — over
20 is an automatic 0 (§6.5). English, ≤ 15 MB.

### 7. BMC PDF — 3 reword fixes — **P1 · You**
In `Palm_Guard_BMC_A4.pdf`: (a) drop the unproven "70%+" loss-reduction figure (or
mark it a design target); (b) make "30–90 days early warning" a **target pending
field validation**; (c) label **LoRa / Bluetooth-Mesh** as **roadmap**, not
current (the node is WiFi/HTTP today). Keep it matching the codebase.

---

## 🪧 Booth build — **P0 · You** (fully specified in [`docs/BOOTH_PLAN.md`](BOOTH_PLAN.md))
The booth is a **25-point** line, currently at zero physical readiness. Make it
read as a **robot, not a dashboard.**
- [ ] Print 3 wall panels (back hero / left research / right team-impact-business).
- [ ] Build the table centerpiece: **live node clamped to a palm-log + pump +
      ≤1 L clear-water reservoir + catch tray** (judges must see it dose), monitor
      secondary, `ARM→CONFIRM→DOSE` safety placard.
- [ ] QR codes (repo + video), **≥ 2 printed report copies** (§6.4), business cards.
- [ ] Spares (node, sensors, pump, cables), **220 V type C/F adapters** + power
      strip, offline dashboard build + video file.
- **Done when:** the booth is built within the 2×2×2 m footprint and live-ready.

---

## 🎤 Rehearsal & team — **P1 · You**
- [ ] Assign booth roles (pitch / demo driver / Q&A) — every member can do each.
- [ ] Rehearse the **5-min pitch + 5-min Q&A** from [`docs/JUDGE_QA.md`](JUDGE_QA.md).
- [ ] Dry-run the live demo ([`docs/DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md)) end-to-end.

---

## 🤖 Optional — I (Agent) can produce these on request
- [ ] **5-minute pitch script** (mapped to the booth walls + JUDGE_QA).
- [ ] **Printed-panel copy** (exact text per wall + safety placard) so the print
      shop just sets type.
- [ ] **Judge-facing one-pager** (slogan + value line + detect→decide→act + 3
      honest facts).
- [ ] **`ml/SETUP_KAGGLE.md`** — the exact clicks to get `kaggle.json`.

---

## Rubric coverage (where the remaining work earns points)
| Area | Status | Remaining item(s) |
|---|---|---|
| Robotic solution / autonomy | code done | **#1 flash+validate** makes the autonomy claim real |
| Research & report (incl. §6.5, ≤20 pp) | draft done | **#4 #5 #6** fills + citations + PDF page-check |
| Demonstration / video (§5.8) | scripted | **#2** record clear-water demo |
| Detection model honesty | pipeline ready | **#3** train proxy + fill card |
| Booth / presentation (**25 pts**) | planned | **#8 #9** build + rehearse |
| Business model | drafted | **#7** 3 BMC reword fixes |

---

## One-line status to keep in mind
**Software & docs are done and honest; the remaining work is physical — flash the
node, shoot the clear-water video, train the proxy model, finalize the report PDF
(≤20 pp), and build/rehearse the booth.** None of it requires more code; it
requires the hardware, the datasets, and the print/booth logistics — plus the real
citations only the team can vouch for.
