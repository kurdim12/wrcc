# Judge Q&A — hard questions, honest answers

Grounded in what's **actually built** (see `BUILD_LOG.md`, `CLAIMS_AUDIT.md`).
Principle: a modest claim that survives scrutiny beats a flashy one that breaks
under one question. Lead with the limit, then the mitigation.

---

### Q1. "It's an airborne microphone. The larvae are *inside* the trunk — can you actually hear them?"
**Honest answer.** Not reliably in all conditions, and we don't claim to. RPW
larvae feeding is structure-borne; an airborne MEMS mic (INMP441) picks up the
boring/feeding signature best in **quiet, close, night** conditions — wood and
distance attenuate it. That's exactly why the UI says "acoustic activity," shows
a probability with a caveat, and **fuses** the mic with vibration (SW-420),
trunk-core temperature (DS18B20) and VOC (BME680) so no single weak channel
decides. The honest upgrade path is a contact/probe transducer; the airborne
node is the low-cost, per-tree starting point.

### Q2. "What's your model's accuracy / AUC?"
**Honest answer.** We don't quote one, because we haven't earned one yet. There
is **no trained model in the system today** — the scorer runs a clearly-labelled
heuristic baseline (`heuristic-baseline-v0`, marked *uncalibrated*). Quoting an
accuracy now would be dishonest. What we *can* show is that the full ML pipeline
(prepare → train → export → serve) **runs end-to-end** (we proved it on toy
data, labelled TOY), and that real metrics will be reported on a **grouped,
held-out test set, split by recording**, and labelled **proxy** until we have
real RPW audio.

### Q3. "So there's no real training data?"
**Honest answer.** Correct, and that's the hard part of this problem — there is
**no large open dataset of airborne-mic recordings of real RPW**. Our plan,
which is coded and ready: train on **functional proxies** (stored-grain weevils,
wood borers boring/feeding — e.g. ASPID/TreeVibes), augment with farm/greenhouse
ambient noise across SNRs (ESC-50), and **report metrics on the proxy set,
labelled as proxy**. The single highest-value next step is recording **our own
INMP441 clips** (we ship `tools/record_inmp441.py` + a capture protocol) to
fine-tune and, crucially, **validate on our mic in our conditions** — far more
credible than any proxy number.

### Q4. "Does it spray pesticide automatically? What if it's wrong?"
**Honest answer.** It never sprays autonomously — by design. A false positive on
an unvalidated detector would pesticide a *healthy* palm, so dosing requires
**both**: the node is **armed** by a human **and** a dose is **confirmed** by a
human (the confirm modal shows the tree, fused risk, and the proxy caveat).
Beyond that, hard caps are enforced **independently on the server and on the
device** — max doses/day, a cooldown, a max single-dose duration, and
anti-replay on the command nonce. We have **19 automated tests** proving each
guard blocks an over-cap / replayed / disarmed dose on its own.

### Q5. "Two layers of caps — isn't that redundant?"
**Honest answer.** Intentionally. The server is authoritative, but the device
must be safe even if the backend misbehaves or a command is replayed over a
flaky link. So the firmware re-checks armed + pump_ms ≤ max + cooldown +
daily-cap + nonce before it ever energises the pump, plus a physical disarm that
hard-cuts the pump. Two independent guards is the right posture for anything that
releases a chemical.

### Q5b. "Is it actually autonomous, or remote-controlled?" (Rules 5.1.1 / 5.1.3)
**Honest answer.** Detection and the risk *decision* are autonomous: each node
samples its own sensors, runs the 1024-pt FFT and acoustic-activity scoring on
the ESP32, and decides risk with no operator. In the on-device autonomy build
(`PG_ONBOARD_AUTONOMY`) the node also decides to **request a dose on its own** —
the server is only monitoring/audit, not the control loop — and it can run fully
hands-off (`auto_confirm`). The one step we deliberately keep human-confirmed is
the **irreversible chemical action**: a false dose pesticides a healthy palm, so
we gate that as a safety/ethics choice (which the rulebook explicitly rewards),
**not** as remote control. The robot decides; the human authorises the chemical.

### Q5c. "Did your team write this code?" (Rule 5.3)
**Honest answer.** We used an AI coding assistant as a tool — like an IDE,
compiler, or Stack Overflow. The team conceived the system, designed the
hardware and the multi-sensor architecture, made every engineering decision, and
**understands and can modify every line** — happy to open any file and explain
or change it live. We don't hide the tool-use; we own the result. (No third-party
or coach wrote the solution.)

### Q6. "How do you know it's RPW and not some other insect or machinery?"
**Honest answer.** For v1 we don't do **species ID** — we'd need labelled RPW
audio we don't have, so claiming species classification would be dishonest. v1
is a binary **activity vs clean** detector, deliberately scoped. We reduce false
triggers by fusing four sensors and by adaptive weighting (e.g. wind/vibration
down-weights the acoustic channel). Machinery/wind looks different across those
channels than sustained internal feeding.

### Q7. "Why 16 kHz? Isn't the signal higher frequency?"
**Honest answer.** The feeding/boring energy sits **low** — literature reports
activity around ~2.25 kHz with clicks roughly in the 0.5–4 kHz range, **not**
~4.5 kHz. 16 kHz sampling (Nyquist 8 kHz) comfortably covers that band; the
limit is SNR and coupling, not bandwidth. We removed an earlier hardcoded
"4.5 kHz RPW centroid" assumption — the model owns the spectral decision, and the
spectrogram's highlighted band is labelled a *literature guide*, not the detector.

### Q8. "Can it run all day on solar?"
**Honest answer.** Not at full duty — continuous audio + WiFi + actuation on a
~1 W solar node won't sustain 24/7, and we don't claim it. The node is
**duty-cycled**: short listen+inference windows, sleep between, waking faster
only when risk is elevated; the pump and bright LEDs are gated hard (status LED
only, never the full strip). The exact field duty cycle is a bench-validation
item (`docs/BENCH_BRINGUP.md`), not a number we'll invent.

### Q9. "Is this running on the real hardware right now?"
**Honest answer.** What you're seeing is the full software pipeline driven by a
realistic device simulator (the demo banner is up the whole time). The firmware
is written to spec but **not yet flashed** — we don't have the board here, and we
won't claim field validation we haven't done. We ship `docs/BENCH_BRINGUP.md`: a
start-to-finish checklist (pin scan, per-sensor checks, the ~1 s mel-window
timing/RAM check, a **dry** pump test, end-to-end against this backend) so
bring-up is fast and safe once we have the node.

### Q10. "On-device edge AI?"
**Honest answer.** Host inference is v1 — reliable and easy to iterate. We've
**exported an int8 TFLite model** (proven on toy data) for `esp-tflite-micro`,
but on-device inference is a **documented stretch goal**, not validated on
hardware, so we won't present it as done.

### Q11. "What's genuinely real vs demo today?"
**Honest answer.** Real and tested: the end-to-end pipeline (capture → log-mel →
score → multi-sensor fusion → 7-rule alerts → armed+confirmed dose → history),
the dual-guard dose safety (19 tests), offline/degradation resilience, and a
reproducible ML pipeline. Not yet: a trained model (heuristic today), flashed
firmware, and field data. We can point to each in the code.

---

## The "MUST NOT claim" list (from CLAIMS_AUDIT.md — keep these off the deck)
- Any **accuracy / AUC / precision / recall** number (no validated model).
- "Trained on RPW" / "validated on RPW" (proxy + heuristic only; no model trained).
- "Autonomous treatment / auto-spray" (it's human-confirmed by design).
- "Mesh network", "500 m range", "X-month battery life", "field-tested".
- A specific detection **lead time** ("3–6 months") as a measured result.
- A fixed RPW frequency (e.g. 4.5 kHz) as the detection rule.

## Safe, strong claims (verified — say these with confidence)
- Acoustic + multi-sensor **early-warning** with **human-armed + confirmed**
  targeted dosing; caps enforced independently on server **and** device (19/19
  tests pass).
- **Honest by design**: probability + proxy/heuristic badge, never an accuracy
  number; the system states its own limits.
- Live pipeline resilient to ML-down, backend restart, and socket drops.
- A reproducible ML pipeline proven to run, ready for real proxy corpora + our
  own INMP441 clips — with a concrete field-validation plan.
