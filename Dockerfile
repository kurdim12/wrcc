# Palm Guard — single-service production image.
# Express API + Socket.IO + the pre-built React frontend, all on ONE port.
#
# Pinned to Node 22 because the backend uses the built-in `node:sqlite` module
# (added in Node 22), so there is no native addon to compile.
FROM node:22-bookworm-slim

WORKDIR /app

# 1) Install dependencies first so this layer is cached unless a lockfile changes.
#    devDependencies are needed at build time because the frontend build runs Vite.
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix backend --no-audit --no-fund \
 && npm ci --prefix frontend --no-audit --no-fund

# 2) Copy the source and build the frontend -> frontend/dist (Express serves it).
COPY . .
RUN npm run build --prefix frontend

# 3) Runtime. Render injects PORT; server.js reads process.env.PORT and binds
#    0.0.0.0. PG_DB_PATH must point at the mounted persistent disk (see
#    render.yaml) so the SQLite file survives restarts and redeploys.
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "start", "--prefix", "backend"]
