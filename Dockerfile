# ── Stage 1: Build the Preact dashboard ──────────────────────────
FROM node:24-bookworm AS dashboard-builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm config set minimumReleaseAge 0 && pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM node:24-bookworm AS runtime

WORKDIR /app

# Install ffmpeg + Playwright Chromium with system dependencies
RUN npm install -g playwright && \
    npx playwright install --with-deps chromium && \
    npm uninstall -g playwright && \
    apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy built dashboard
COPY --from=dashboard-builder /app/dist ./dist

# Copy streamer code
COPY streamer/package.json streamer/tsconfig.json ./streamer/
WORKDIR /app/streamer
RUN corepack enable && pnpm install --prod
WORKDIR /app

# Copy streamer source
COPY streamer/index.ts ./streamer/

# Install tsx globally for running TypeScript
RUN npm install -g tsx

# Environment defaults
ENV DASHBOARD_DIR=/app/dist
ENV FRAME_RATE=5
ENV RTSP_URL=rtsp://mediamtx:8554/weather
ENV REFRESH_INTERVAL=600000
ENV VITE_WEATHER_LAT=40.7128
ENV VITE_WEATHER_LON=-74.006
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

EXPOSE 3456

CMD ["tsx", "streamer/index.ts"]
