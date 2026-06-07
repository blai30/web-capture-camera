# web-capture-camera is a virtual ONVIF camera: a Node 24 process running TypeScript directly (via
# native type stripping, no build step) that screenshots a configurable URL in headless Chromium,
# encodes those frames to H.264 via ffmpeg, and serves them over RTSP + ONVIF. Built for
# linux/arm64 (Raspberry Pi 5); build natively on the Pi.

FROM node:24-bookworm-slim
WORKDIR /app

# System Chromium (arm64) + ffmpeg (libx264 software H.264; the Pi 5 has no hardware encoder).
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

# Puppeteer's Chrome-for-Testing has no linux-arm64 build; skip the download and use system Chromium.
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY server ./server

CMD ["node", "server/index.ts"]
