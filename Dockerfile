# Build stage
FROM node:24-bookworm AS build
WORKDIR /app

# Accept weather config as build args
ARG VITE_WEATHER_LAT
ARG VITE_WEATHER_LON
ARG VITE_WEATHER_NAME
ARG VITE_WEATHER_TIMEZONE
ENV VITE_WEATHER_LAT=${VITE_WEATHER_LAT}
ENV VITE_WEATHER_LON=${VITE_WEATHER_LON}
ENV VITE_WEATHER_NAME=${VITE_WEATHER_NAME}
ENV VITE_WEATHER_TIMEZONE=${VITE_WEATHER_TIMEZONE}

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build && npm run build:server

# Install Playwright Chromium in build stage
RUN npx playwright install chromium

# Runtime stage
FROM node:24-bookworm-slim
WORKDIR /app

# Install FFmpeg and Playwright system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxkbcommon0 \
    xdg-utils \
    fonts-liberation \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy Playwright browser from build stage
COPY --from=build /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy built app
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/tsconfig.server.json ./tsconfig.json
COPY package.json ./

EXPOSE 3000 8080 554 3702/udp
ENV NODE_ENV=production
CMD ["node", "--import", "tsx/esm", "src/server/index.ts"]
