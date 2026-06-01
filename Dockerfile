FROM node:24-bookworm

# Bind environment settings to the system chromium engine location
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install system dependencies for rendering and video streaming
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.server.json index.ts ./
RUN npm install -g pnpm && pnpm install

# Initialize virtual canvas and execute using tsx
CMD ["sh", "-c", "Xvfb :99 -screen 0 1920x1080x24 & DISPLAY=:99 npx tsx index.ts"]
