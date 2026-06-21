# Demo runbook (Baku, on stage)

The exact path to run the full story — **capture → fuse → alert → arm → confirm →
dose → history** — plus the failure drill. Everything here uses what's actually
built. The line to lead with (§14):

> *"Acoustic + multi-sensor early warning with human-confirmed targeted dosing.
> The model is validated on proxy boring sounds today; here's exactly how we'd
> field-validate on real RPW."*

---

## 0. Pre-flight (≈2 min before going up)

Four terminals (or `npm run dev` from root for backend+frontend together):

```bash
# 1) ML scorer (heuristic baseline — light, no TensorFlow)
cd ml && source .venv/bin/activate 2>/dev/null; uvicorn serve.app:app --port 8001

# 2) backend (Node 22+; fusion auto-targets the ML service on :8001)
cd backend && npm run dev                       # http://localhost:4000

# 3) seed a believable farm (palms + devices + ~48h history + alerts + past doses)
cd backend && npm run seed:farm

# 4) dashboard
cd frontend && npm run dev                       # http://localhost:5173
```

Open `http://localhost:5173`. **Confirm the demo banner is visible** (top-right
LiveBadge shows *demo*) — never hide that it's demo data on stage.

Sanity check (optional): `curl localhost:4000/api/v1/health` and
`curl localhost:8001/health` (expect `model_version: heuristic-baseline-v0`).

Seeded roster you'll use: **PG-DEMO-101** is the pre-existing high-risk node
(already red, with history + past doses); **PG-DEMO-115** is the offline node;
**PG-DEMO-105** (healthy) is the one we'll drive live so the audience watches it
go green → red.

---

## 1. The story (click path)

1. **Overview** — point out the farm: 16 nodes, KPIs (avg risk, online %), the
   palm map (1 red / 2 orange / rest green), and the 30-day risk-trend chart
   (real seeded history, not empty). Open **PG-DEMO-101** → drawer shows the
   ConfidenceBadge: `P(activity)` + a **heuristic** badge (not "X% accurate").

2. **Live Spectrogram** — select **PG-DEMO-105**. Note the ~0.5–4 kHz **feeding
   band** outline (labeled "literature guide; model owns the call") and the
   `SA = 100·P(activity)` readout with its **heuristic/proxy** badge.

3. **Arm the node** — go to **Dosing** (or the palm drawer) → **Arm** PG-DEMO-105.
   State plainly: *"Nothing can dose unless a human arms it AND confirms it."*

4. **Trigger the detection** (scripted, so it's reliable on stage):
   ```bash
   tools/demo_event.sh PG-DEMO-105 15
   ```
   Watch over ~20–30 s: feeding-band energy rises on the spectrogram, `SA` climbs,
   `risk_fused` crosses 61 → a **HIGH_RISK** alert fires → the **Confirm-dose
   modal** pops (because the node is armed). It shows device, fused risk, pump
   volume, and the proxy caveat.

5. **Confirm the dose** — click **Confirm dose**. Toast confirms; the dose moves
   `pending → sent → done` (the demo driver executes it + acks the nonce).

6. **Dose history** — Dosing page: the dose appears as `done` with time, trigger
   risk, volume, source. Done — full loop on screen.

### Reset between rehearsals
A node enters a 30-min cooldown after dosing (a real safety cap). For repeated
runs either use a different healthy node (PG-DEMO-104/106/…), or clear cooldown:
```bash
curl -s -X PATCH localhost:4000/api/v1/devices/PG-DEMO-105/policy \
  -H 'Content-Type: application/json' -d '{"cooldown_s":0}'
```
To show a fully hands-off variant, set `{"auto_confirm":true}` on a node — the
server auto-confirms (still gated by arm + caps). Default OFF so the human gate
is visible.

---

## 2. On-stage failure drill (map each failure to the built fallback)

Stay calm and **narrate the degradation** — owning it is the strongest demo move.

| If this happens | What you'll see | What to say / show |
|---|---|---|
| **Venue WiFi / socket drops** | Amber banner "Live link reconnecting — data may be a few seconds stale". | "The node never blocks — it buffers and re-syncs; the dashboard reconnects with backoff, no reload." Data resumes on its own. |
| **ML service dies** (kill `uvicorn`) | Readings keep flowing; the confidence badge flips to **heuristic** (`model_version: fallback`). | "Ingestion never blocks on the model — we degrade to a transparent heuristic and label it honestly." Restart uvicorn → badge returns. |
| **Backend restarts / unreachable** | Red banner "Backend unreachable — retrying"; last data stays on screen. | "No white-screen — it shows last-known state and auto-recovers." Comes back without a reload. |
| **On-stage capture is noisy** (live mic flaky) | — | Don't fight it. Run `tools/demo_event.sh` — the scripted event drives the same detect→dose pipeline from synthetic signal. The **demo banner stays up** — we never pretend synthetic is live. |
| **A render glitch on one page** | Friendly "This view hit a snag — Retry" card (ErrorBoundary). | "The rest of the dashboard stays up; one panel retries in place." |

Hard-reset everything: `Ctrl-C` all four terminals, re-run §0. The DB is at
`backend/data/palmguard.db` (delete it for a totally fresh farm, then re-seed).

---

## 3. Two-sentence close
*"Today the acoustic model is a transparent heuristic, validated on proxy boring
sounds — we show a probability with a 'proxy' badge, never an accuracy number.
The dose is always human-armed and confirmed, with hard caps enforced on both the
server and the device — here's our exact path to field-validate on real RPW."*
