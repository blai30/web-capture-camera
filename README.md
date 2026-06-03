# weather-dash

A live weather dashboard

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

## Unifi Protect Viewport

If you're integrating with Unifi Protect viewports, note the following:

- **Streams:** Every camera exposes a `main_stream` and a `sub_stream`.
- **Root cause:** The ONVIF stream didn't include a low-quality `sub_stream`, which caused multi-view problems.
- **Single view:** `main_stream` is used for full-quality display (e.g., when showing a single camera).
- **Multi view:** The viewport uses `sub_stream` for multi-camera views.
- **Why web UI worked:** The Unifi web UI always uses `main_stream`, so it didn't exhibit the multi-view issue.
- **Solution:** Make sure to include the lowQuality profile in onvif.yaml to enable sub_stream.

## Weather Data

Powered by [Open-Meteo](https://open-meteo.com/) — free, no API key required. Data refreshes every 10 minutes.
