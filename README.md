# weather-dash

A live weather dashboard

## Development

### Prerequisites

- Node.js 24+
- pnpm
- Docker & Docker Compose

### Local Development

The dashboard frontend and the capture/streaming server run as two processes:

```bash
# Install dependencies
pnpm install

# Terminal 1: frontend dev server (http://localhost:5173)
pnpm dev

# Terminal 2: ONVIF/RTSP/capture server (optional; needs ffmpeg on PATH)
pnpm dev:server
```

`pnpm dev` alone renders the Preact dashboard at `http://localhost:5173` for UI work. To exercise the full camera pipeline locally, also run `pnpm dev:server` and set `APP_URL=http://localhost:5173` in `.env` so the capturer points at the Vite dev server, otherwise the server serves the built SPA on `APP_PORT` (default `8080`). The server spawns `ffmpeg`, so it must be on your `PATH`.

## Production Deployment (Raspberry Pi 5)

The app is packaged as a Docker image for `linux/arm64` (Raspberry Pi 4/5) via `Dockerfile` +
`docker-compose.yml`. The image bundles system Chromium and ffmpeg.

**Build it natively on the Pi:** emulated cross-builds from an x86 machine are slow and unreliable (Chromium especially).

**1. Install Docker on Raspberry Pi OS (64-bit):**

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER   # then log out / back in
```

**2. Get the code and configure `.env`:**

```bash
git clone <repo-url> weather-dash && cd weather-dash
cp .env.example .env
```

Edit `.env` and set at least:

- `DEVICE_HOSTNAME`: the Pi's LAN IP (e.g. `192.168.0.32`). Every advertised ONVIF/RTSP/snapshot URL
  is built from this, so it must be reachable by your NVR. Reserve a DHCP lease so it stays stable.
- `NODE_ENV=production`
- `VITE_WEATHER_LAT` / `VITE_WEATHER_LON` / `VITE_WEATHER_NAME` / `VITE_TIMEZONE`: your location.
  These are **baked into the build**, so changing location later requires a rebuild.
- Optional: `APP_PORT` (dashboard, default `8080`), `RTSP_PORT` (default `554`), `ONVIF_PORT`
  (default `8020`), and the `DEVICE_*` identity fields.

**3. Build and run:**

```bash
docker compose build      # native arm64; installing Chromium is the slow step
docker compose up -d
docker compose logs -f
```

The container uses host networking, required so ONVIF WS-Discovery multicast and the advertised URLs
work on the LAN. Services exposed on the Pi:

| Port                | Service                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `8080` (`APP_PORT`) | Weather dashboard SPA: also a handy debug view of what the camera renders |
| `554`               | RTSP stream: `rtsp://<pi-ip>:554/weather`                                 |
| `8020`              | ONVIF SOAP + snapshot (`/onvif/snapshot`)                                 |
| `3702/udp`          | WS-Discovery (device auto-discovery)                                      |

**4. Verify** (from another host on the same subnet):

```bash
curl -sI http://<pi-ip>:8080/                            # dashboard → 200
ffprobe -rtsp_transport tcp rtsp://<pi-ip>:554/weather   # H.264 720p stream
curl -s http://<pi-ip>:8020/onvif/snapshot -o snap.png   # latest frame (PNG)
```

Then add the camera in Unifi Protect via ONVIF discovery, it appears as **Weather Dash**.

**Updating:** `git pull && docker compose build && docker compose up -d`.

## Unifi Protect Viewport

If you're integrating with Unifi Protect viewports, note the following:

- **Streams:** Every camera exposes a `main_stream` and a `sub_stream`.
- **Root cause:** The ONVIF stream didn't include a low-quality `sub_stream`, which caused multi-view problems.
- **Single view:** `main_stream` is used for full-quality display (e.g., when showing a single camera).
- **Multi view:** The viewport uses `sub_stream` for multi-camera views.
- **Why web UI worked:** The Unifi web UI always uses `main_stream`, so it didn't exhibit the multi-view issue.
- **Solution:** Make sure to include the lowQuality profile in onvif.yaml to enable sub_stream.

## Weather Data

Powered by [Open-Meteo](https://open-meteo.com/) - free, no API key required. Data refreshes every 10 minutes.
