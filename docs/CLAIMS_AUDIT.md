# Claims audit — report/deck vs code reality (judge-defense)

Owning the limit beats getting caught on it (§14). This maps every claim Palm
Guard might make to what the code actually does **as of this build**, so the
report/deck and the on-stage answers stay consistent. (No report text was
supplied, so this audits the claims the UI/README make + the claims a deck
typically makes.)

Verdicts: ✅ supported · ⚠️ supported only with nuance · ❌ must NOT claim yet.

| # | Claim | Code reality | Verdict |
|---|-------|--------------|---------|
| 1 | "Trained AI/ML model detects RPW" | A reproducible **proxy** model (`cnn-aspid-v1`) is trained + grouped-CV-evaluated on ASPID (stored-product insect **larvae feeding** vs No-Insects, MIT). Artifacts are gitignored, so a fresh clone still serves `heuristic-baseline-v0`. **Not** RPW-trained, **not** field-validated. | ⚠️ Say "acoustic model trained + cross-validated on an open **proxy** (insect-larvae feeding vs clean); a **proxy** result, **not RPW**; field validation is the next step." |
| 2 | Any "% accuracy / AUC / detection rate" | Real **proxy** metrics now exist: grouped 5-fold CV **ROC-AUC 0.905 / PR-AUC 0.926** on ASPID activity-vs-clean (`silence` condition). No RPW or field metric exists. | ⚠️ Quote **only as a proxy number, explicitly labelled** (e.g. "ROC-AUC 0.905 on an open insect-activity proxy — not RPW, not field-validated"). Never as RPW accuracy. |
| 3 | "Detects RPW larvae inside the trunk" | Airborne INMP441; larvae are structure-borne. Reliable mainly quiet/close/night. | ⚠️ Say "flags **acoustic activity consistent with boring/feeding**, most reliably in quiet/close/night." |
| 4 | "Multi-sensor fusion (acoustic + vibration + thermal + VOC)" | Real: `riskScore.js` fuses SA (ML/heuristic) + SV (SW-420) + ST (DS18B20) + SVOC (BME680), adaptive weights. | ✅ |
| 5 | "Human-confirmed targeted micro-dosing, no autonomous spraying" | Dose requires `device.armed` + confirm; caps on **both** server + device; verified by 19 tests. | ✅ (lead with this — it's a strength) |
| 6 | "Detects 3–6 months before visible symptoms" | Early-warning is the thesis; we have **not measured** lead time. UI copy softened to "before crown symptoms show." | ⚠️ Frame as the goal/mechanism, not a measured figure. |
| 7 | "24/7 real-time farm-wide monitoring" | Per-tree node, **duty-cycled** on ~1 W solar; not continuous full-duty; not farm-wide from one mic. | ⚠️ Say "continuous per-tree monitoring, duty-cycled for solar." |
| 8 | "Mesh network / 500 m range" | Not built. BLE/ESP-NOW multi-node is a documented **stretch goal**. Removed from the UI stats. | ❌ Do not claim a mesh until built. |
| 9 | "6–12 month battery / solar-powered" | Solar charging in BOM; power budget is tight and the field duty cycle is **not yet validated**. | ⚠️ Say "solar-assisted; field duty-cycle TBD on the bench." |
| 10 | "On-device / edge TFLite inference" | int8 `.tflite` export **proven on toy data**; host inference is v1; on-device not run on hardware. | ⚠️ Say "host inference today; int8 edge build exported, edge deployment is a stretch." |
| 11 | "Field-tested on real palms" | Firmware **not yet flashed**; no field data collected. | ❌ Do not claim field validation. |
| 12 | "BME680 VOC detection" | Enabled (`PG_BME680_PRESENT 1`), degrades gracefully; SVOC contributes after ~20 min warm-up. | ✅ (note the warm-up) |
| 13 | "Offline-resilient" | Verified: firmware non-blocking reconnect; backend Rule 5 offline+recover; frontend reconnect banner + error boundary. | ✅ |
| 14 | "RPW signature at ~4.5 kHz" (old) | **Removed.** Literature puts feeding ~0.5–4 kHz; the model owns the spectral call. UI shows a "feeding band (guide)". | ❌ Don't cite a fixed RPW frequency as the detector. |

## Claims the report/deck MUST NOT make (until earned)
- Any accuracy / AUC / precision / recall number **presented as RPW or field
  performance** (proxy numbers are fine only when explicitly labelled proxy +
  named corpus, e.g. "ROC-AUC 0.905 on the ASPID insect-activity proxy").
- "Trained on RPW audio" or "validated on RPW" (it's a stored-product-insect
  **proxy** model; no RPW audio, no field validation).
- "Autonomous treatment / auto-spray" (it's human-confirmed by design).
- "Mesh network", "500 m range", "X-month battery life", "field-tested".
- A specific detection **lead time** ("3–6 months") as a measured result.
- A fixed RPW frequency (e.g. 4.5 kHz) as the detection rule.

## Claims you CAN make confidently (verified in this build)
- Acoustic + multi-sensor **early-warning** with **human-armed + confirmed**
  targeted dosing; dose caps enforced independently on server **and** device
  (19/19 safety tests pass).
- **Honest by design:** probability + proxy/heuristic badge, never an accuracy
  number; the system states its own limits.
- End-to-end live pipeline (capture → log-mel → score → fuse → alert → confirm →
  dose → history), resilient to ML-down, backend-restart, and socket drops.
- A reproducible ML pipeline (prepare → train → export → serve), now **trained +
  grouped-CV-evaluated on a real open proxy** (ASPID insect-larvae feeding vs
  clean): **ROC-AUC 0.905 / PR-AUC 0.926 (proxy)**. Next: your-own INMP441 clips.
- The clearest next step, owned out loud: **record real INMP441 data and
  field-validate** (the line to lead with, §14).
