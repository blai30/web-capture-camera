# weather-dash is an ONVIF "weather camera": a tsx-run Node process that renders the Preact
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
# --prod=false: the app runs uncompiled via tsx (a devDependency), so dev deps are required.
RUN pnpm install --frozen-lockfile --prod=false

# Uncompiled server source + built frontend. wsdl files live under server/onvif and are read at
# runtime, so copying the server tree is sufficient.
COPY server ./server
COPY tsconfig*.json ./
COPY --from=build /app/dist ./dist

CMD ["pnpm", "exec", "tsx", "server/index.ts"]
