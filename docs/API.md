# Palm Guard - HTTP API

Base URL in dev: `http://localhost:4000` (Vite proxies `/api/*` so the React app uses relative URLs).

## REST endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/health` | `{ ok, service, db_path, readings_count, server_ts, uptime_s }` |
| `POST` | `/api/v1/readings` | **ESP32 ingestion**. Schema below. Computes risk score, runs alert engine, broadcasts. Response: `{ ok, id, risk_score, classification, stream_bands, server_ts }` |
| `GET` | `/api/v1/readings/latest` | Latest reading per device |
| `GET` | `/api/v1/readings?device_id=&since=&limit=` | Paged history (default last 24h, max 5000) |
| `GET` | `/api/v1/devices` | All devices with computed online/idle/offline status |
| `GET` | `/api/v1/devices/:id` | One device |
| `POST` | `/api/v1/devices` | Upsert (assign palm, set fw_version) |
| `PATCH` | `/api/v1/devices/:id` | Same as POST |
| `DELETE` | `/api/v1/devices/:id` | Removes device + cascades to readings |
| `GET` | `/api/v1/palms` | All palms with their latest classification |
| `GET` | `/api/v1/palms/:id` | One palm |
| `POST` | `/api/v1/palms` | Upsert one palm |
| `POST` | `/api/v1/palms/bulk` | Bulk upsert (used by `tools/seed_palms.py`) |
| `PATCH` | `/api/v1/palms/:id` | Partial update |
| `DELETE` | `/api/v1/palms/:id` | Removes palm |
| `GET` | `/api/v1/alerts?status=&since=&limit=` | List alerts |
| `GET` | `/api/v1/alerts/counts` | `{ active, critical, warning, low }` |
| `PATCH` | `/api/v1/alerts/:id` | `{ status: 'acknowledged' \| 'resolved' }` |
| `GET` | `/api/v1/stats/farm` | KPI bundle for the Overview page |
| `GET` | `/api/v1/stats/risk-trends?days=30` | Daily avg/max risk for the chart |
| `GET` | `/api/v1/stats/temperature-distribution` | 5-bucket histogram of `core_c - amb_c` |
| `GET` | `/api/v1/reports/list` | List of available CSV reports |
| `GET` | `/api/v1/reports/weekly.csv` | Weekly summary |
| `GET` | `/api/v1/reports/critical.csv` | Critical incidents log |
| `GET` | `/api/v1/reports/battery.csv` | Battery efficiency report |
| `GET` | `/api/v1/intelligence` / `/:deviceId` | Multi-sensor expert decision (fusion + experts + safety + explanation) |

## ESP32 ingestion payload

```json
POST /api/v1/readings
Content-Type: application/json

{
  "v":   1,
  "dev": "PG-001",
  "ts":  1731234567,
  "seq": 4821,
  "ac": {
    "bands":  [-62, -58, -54, -41, -38, -49],
    "peaks":  [[3422, -31], [4180, -34], [5996, -37], [2890, -39], [7102, -42]],
    "cent":   4180,
    "flat":   0.31,
    "rms":    -38,
    "zcr":    0.21,
    "clk":    7.4,
    "bands16": [-65,-60,-55,-50,-45,-40,-35,-32,-30,-32,-35,-40,-45,-50,-55,-60]
  },
  "vb":  { "vib_rms": 0.08, "vib_pk": 0.21, "vib_dom_hz": 12 },
  "th":  { "core_c": 31.4, "amb_c": 29.1 },
  "env": { "amb_c": 29.1, "hum": 54.2, "pres": 1011.3, "gas_kohm": 78.4 },
  "sys": { "bat_pct": 87, "rssi": -61, "fw": "0.1.0", "up_s": 12840 }
}
```

All sub-objects are optional. `bands16` is only sent during stream-mode.

Response:

```json
{
  "ok": true,
  "id": 4821,
  "risk_score": 50.4,
  "classification": "medium",
  "stream_bands": false,
  "server_ts": 1731234568
}
```

When `stream_bands` is `true`, the device should switch to 2 s cycles and include `bands16` in `ac` until the next response says false again.

## WebSocket events (Socket.IO)

Connect to the same origin (or `http://localhost:4000` directly).

| Event | Direction | Payload |
|---|---|---|
| `hello`                  | server -> client | `{ ts }` (sent on connect) |
| `live:reading`           | server -> client | full reading row, plus `bands16` and additive `intelligence` if present |
| `live:bands`             | server -> client | high-rate spectrogram frame `{ device_id, bands16, ac_rms }` |
| `live:alert`             | server -> client | alert row (insert or update) |
| `risk:fusion`            | server -> client | fused risk + level + confidence + recommendation + explanation |
| `agents:update`          | server -> client | per-expert breakdown + safety + model honesty |
| `device:status`          | server -> client | `{ id, status, new? }` |
| `subscribe:spectrogram`  | client -> server | `deviceId` (60 s window) |
| `unsubscribe:spectrogram`| client -> server | `deviceId` |
| `subscribed:spectrogram` | server -> client | `{ device_id, until }` |

## Verification with curl

```bash
# Health
curl http://localhost:4000/api/v1/health

# Submit a synthetic reading
curl -X POST http://localhost:4000/api/v1/readings \
  -H "Content-Type: application/json" \
  -d '{"v":1,"dev":"TEST","ac":{"clk":12,"bands":[-70,-65,-58,-25,-22,-50],"cent":4500,"flat":0.15,"rms":-28},"th":{"core_c":36,"amb_c":28},"env":{"hum":54,"gas_kohm":15},"sys":{"bat_pct":80,"rssi":-60}}'

# Most recent reading per device
curl http://localhost:4000/api/v1/readings/latest

# Active alerts
curl 'http://localhost:4000/api/v1/alerts?status=active'

# Farm stats
curl http://localhost:4000/api/v1/stats/farm
```
