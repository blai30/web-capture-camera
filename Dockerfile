# forecast-onvif is an ONVIF "weather camera": a Node 24 process running TypeScript directly (via
# native type stripping, no build step) that renders the Preact
# dashboard in headless Chromium, encodes screenshots to H.264 via ffmpeg, and serves them over
# RTSP + ONVIF. Built for linux/arm64 (Raspberry Pi 5); build natively on the Pi.

# BUILD stage
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Puppeteer's Chrome-for-Testing has no linux-arm64 build; skip the download. The runtime uses
# system Chromium instead (see runtime stage).
ENV PUPPETEER_SKIP_DOWNLOAD=1

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# vite build bakes VITE_* (location) values from .env, so the full source, including .env, must
# be present before building.
COPY . .
RUN pnpm build

# RUNTIME stage
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

# System Chromium (arm64) + ffmpeg (libx264 software H.264; the Pi 5 has no hardware encoder).
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --prod: Node strips types itself, so no build toolchain is needed at runtime, only the runtime
# dependencies. pino-pretty is a devDependency loaded only when NODE_ENV=development, which prod
# never sets, so omitting dev deps is safe.
RUN pnpm install --frozen-lockfile --prod

# Uncompiled server source + built frontend. Node reads no tsconfig for type stripping, and the
# wsdl files live under server/onvif and are read at runtime, so copying the server tree is enough.
COPY server ./server
COPY --from=build /app/dist ./dist

CMD ["node", "server/index.ts"]
