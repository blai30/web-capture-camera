# Weather Camera

A virtual IP camera that streams a live weather dashboard to UniFi Protect Viewport via RTSP. Built with Preact, Playwright, ffmpeg, and Docker — designed to run on a Raspberry Pi.

## What It Does

Instead of a black screen in an empty Viewport slot, this streams a beautiful weather forecast display that UniFi Protect treats as a regular IP camera.

## Architecture

```
Preact Dashboard → Playwright (headless Chromium) → ffmpeg → mediamtx → UniFi Viewport
```

## Quick Start

### 1. Configure Your Location

Copy the example env file and edit it:

```bash
cp .env.example .env
```

Edit `.env` with your coordinates:

```env
VITE_WEATHER_LAT=40.7128
VITE_WEATHER_LON=-74.006
VITE_WEATHER_NAME=New York
```

### 2. Build & Run

```bash
docker compose up --build
```

This starts two containers:

- **mediamtx** — lightweight RTSP server on port `8554`
- **weather-camera** — renders the dashboard and streams frames

### 3. Verify the Stream

Test with VLC or any RTSP player:

```
rtsp://localhost:8554/weather
```

### 4. Add to UniFi Viewport

1. Open UniFi Protect Viewport settings
2. Add a new camera → "Third-party camera"
3. Enter the RTSP URL: `rtsp://<raspberry-pi-ip>:8554/weather`
4. Place it in the empty slot of your 2×2 grid

## Configuration

| Environment Variable | Default    | Description                          |
| -------------------- | ---------- | ------------------------------------ |
| `WEATHER_LAT`        | `40.7128`  | Latitude for weather data            |
| `WEATHER_LON`        | `-74.006`  | Longitude for weather data           |
| `WEATHER_NAME`       | `New York` | Display name for location            |
| `FRAME_RATE`         | `5`        | Frames per second (lower = less CPU) |
| `REFRESH_INTERVAL`   | `600000`   | Dashboard reload interval (ms)       |

## Development

### Prerequisites

- Node.js 22+
- pnpm
- Docker & Docker Compose

### Local Development (Without Docker)

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

This runs the Preact dashboard in development mode at `http://localhost:5173`.

### Raspberry Pi Deployment

The Docker image is built for `linux/arm64` (Raspberry Pi 4/5). The multi-stage build keeps the final image lean:

1. Builds the Preact dashboard
2. Installs Playwright Chromium + ffmpeg
3. Ships only the runtime artifacts

```bash
# On the Pi
git clone <repo>
cd weather-dash
cp .env.example .env
# Edit .env with your location
docker compose up --build -d
```

## Weather Data

Powered by [Open-Meteo](https://open-meteo.com/) — free, no API key required. Data refreshes every 10 minutes.

## Troubleshooting

**Stream is choppy on the Pi:** Lower `FRAME_RATE` to `3` in `.env`.

**Black screen in Viewport:** Verify the RTSP URL is reachable from the UniFi controller: `vlc rtsp://<pi-ip>:8554/weather`.

**Wrong weather location:** Check `WEATHER_LAT` and `WEATHER_LON` in `.env`.

**Container won't start:** Check logs with `docker compose logs weather-camera`.
