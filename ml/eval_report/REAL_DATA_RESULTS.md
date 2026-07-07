# Real-Data Model — Results & Honesty Note

Palm Guard now ships a model trained on **real recordings**, not synthetic data.

## Data (real, openly sourced — no credentials)
| Set | What | Use |
|---|---|---|
| `cbalingbing/Rice-Acoustic-Sensor` | 75 real weevil/borer **feeding-sound** WAVs (incl. *Sitophilus oryzae*, a true weevil), ~8 kHz | training |
| USDA-ARS **Mankin Sound Library** | 7 genuine **Red Palm Weevil** (*Rhynchophorus ferrugineus*) clips (piezo / accel / PVDF / ultrasonic / Aruba larvae) | genuine-species reference + demo audio |

## Models trained (leakage-safe: GroupKFold **by recording** — train/test never share a file)
| Model | Features | OOF ROC-AUC | Where it runs |
|---|---|---|---|
| `real-logreg-v1` | 11 (rms, zcr, centroid, flatness, click + 6 bands) | **0.745** | host / backend acoustic scoring |
| `real-edge-logreg-v1` | 5 device-portable (rms, zcr, centroid, flatness, click) | **0.669** | **on the ESP32-S3** (`include/pg_model.h`, edge build) |

54,838 labelled 1 s windows · 75 recordings · balanced (≈27.8k pos / 27.0k neg).
Genuine-RPW cross-sensor reference: mean activity 0.249 on the 7 real RPW clips (illustrative — different sensor/species, not a metric).

## Honesty (unchanged mandate)
- Task is **"insect-feeding acoustic activity vs quiet"** — a *proxy* for RPW, never claimed as field-validated RPW accuracy.
- The corpus is proxy-species and not airborne-INMP441; **airborne-mic field validation is the documented next step**.
- The on-device model uses only features the chip computes identically, so the 0.669 number transfers honestly (no quantization/band-edge fudging).
- The dose path stays **human-armed + capped + nonce-gated** regardless of the model output.

## Reproduce
```
python ml/train_real_compact.py    # writes eval_report/real_model.json, real_model_edge.json, real_metrics.json
```
Artifacts: `real_model.json` (host) · `real_model_edge.json` (device) · `real_metrics.json` · firmware `include/pg_model.h`.
