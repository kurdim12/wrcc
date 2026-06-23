# Deploying Palm Guard (Render — single service + persistent disk)

Palm Guard deploys as **one** web service: the Express + Socket.IO backend serves
the built React frontend (`frontend/dist`) on a single URL, with live data over
WebSocket. The `node:sqlite` database lives on a **persistent disk** so it
survives restarts and redeploys. Requires **Node 22+** (built-in `node:sqlite`).

## What's in the repo

- **`Dockerfile` + `.dockerignore`** — portable single-service image (Node 22).
  Used by Railway (and Docker-on-Render / Fly.io). Installs backend + frontend
  deps, builds the frontend, runs the backend which serves `frontend/dist`.
- **`railway.json`** — Railway config: Dockerfile builder + `/api/v1/health`
  health check. (Volume + env vars are set in the Railway dashboard.)
- **`render.yaml`** — Render Blueprint: native Node 22 web service + a 1 GB disk
  at `/var/data`. An alternative to Railway; not used when deploying to Railway.

## Railway (recommended — single service + volume)

1. Push your branch (done): `git push origin claude/elegant-keller-aurxdw`.
2. Railway → **New Project → Deploy from GitHub repo** → **kurdim12/wrcc** →
   branch **`claude/elegant-keller-aurxdw`**. Railway uses the `Dockerfile`.
3. Service → **Variables** → add `PG_DB_PATH = /data/palmguard.db`.
   Do **not** set `PORT` (Railway injects it; the server reads it). `NODE_ENV`
   is already `production` from the Dockerfile.
4. Service → **Volumes** → add a volume mounted at **`/data`** (so the SQLite
   file persists across restarts/redeploys).
5. Service → **Settings → Networking** → **Generate Domain** for a public URL.
6. **Redeploy** so the volume + `PG_DB_PATH` take effect.
7. (Optional, populated demo) once live, run the seeder against the volume —
   easiest via the Railway CLI: `railway run npm run seed:farm --prefix backend`.

### Redeploy on Railway

`git push origin claude/elegant-keller-aurxdw` → Railway auto-builds the new
commit. The volume (and your DB) persists across deploys.

## First deploy (Render dashboard)

1. Push your branch (done): `git push origin claude/elegant-keller-aurxdw`.
2. In the Render dashboard → **New** → **Blueprint**.
3. Connect the GitHub repo **kurdim12/wrcc** (authorize Render's GitHub app once)
   and select branch **`claude/elegant-keller-aurxdw`**. Render reads `render.yaml`.
4. Review the plan: a **Starter** instance (~$7/mo) + a 1 GB disk (~$0.25/GB-mo)
   — the disk requires a paid instance. Confirm to create (this is the billing step).
5. Render builds and deploys. The health check is `/api/v1/health`.

### Environment variables

All set automatically by `render.yaml` — nothing to paste by hand:

| Key | Value | Why |
|---|---|---|
| `NODE_VERSION` | `22.23.0` | Pin Node 22 (node:sqlite) |
| `NODE_ENV` | `production` | Production mode |
| `PG_DB_PATH` | `/var/data/palmguard.db` | DB on the persistent disk |

**Do not set `PORT`** — Render injects it and the server reads `process.env.PORT`.
`PG_ML_URL` is optional; if unset, the backend uses its honest heuristic baseline.

## (Recommended) Seed a populated demo farm

A fresh DB starts empty and demo mode fills it with *live* data, but the rich 48 h
history/alerts/dose timeline comes from the seeder. After the first deploy, open
the service **Shell** in the Render dashboard and run:

```bash
npm run seed:farm --prefix backend
```

It writes to `PG_DB_PATH` on the disk (idempotent — safe to re-run).

## Verify

- `https://<your-app>.onrender.com/` → dashboard loads
- `https://<your-app>.onrender.com/api/v1/health` → `{ "ok": true, ... }`
- Live readings stream over WebSocket
- **Refresh / restart the service** → data persists (proves the disk works)

## Redeploy next time

`autoDeploy` is **off** (no surprise rebuilds/cost). To ship new commits:

1. `git push origin claude/elegant-keller-aurxdw`
2. Render dashboard → the service → **Manual Deploy → Deploy latest commit**.

The disk (and your DB) persists across deploys. To enable auto-deploy on push,
set `autoDeploy: true` in `render.yaml` (or toggle it in the dashboard).
