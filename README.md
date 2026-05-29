# weather-dash

A live weather dashboard

## Quick Start

### Configure Your Location

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

## Configuration

| Environment Variable | Default    | Description                          |
| -------------------- | ---------- | ------------------------------------ |
| `VITE_WEATHER_LAT`   | `40.7128`  | Latitude for weather data            |
| `VITE_WEATHER_LON`   | `-74.006`  | Longitude for weather data           |
| `VITE_WEATHER_NAME`  | `New York` | Display name for location            |
| `FRAME_RATE`         | `5`        | Frames per second (lower = less CPU) |
| `REFRESH_INTERVAL`   | `600000`   | Dashboard reload interval (ms)       |

## Development

### Prerequisites

- Node.js 24+
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

The Docker image is built for `linux/arm64` (Raspberry Pi 4/5).

## Weather Data

Powered by [Open-Meteo](https://open-meteo.com/) — free, no API key required. Data refreshes every 10 minutes.
