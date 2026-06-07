# web-capture-camera

A virtual ONVIF camera that turns **any web page into a camera feed** for your NVR. It renders a
configurable URL in headless Chromium, screenshots it on an interval, and encodes those frames into
an H.264 RTSP stream fronted by an ONVIF SOAP server with WS-Discovery, so an NVR such as Unifi
Protect auto-discovers it and shows the page as if it were a real camera.

Point it at a dashboard, a status board, a kiosk page, a live chart, a webcam-style web app —
whatever renders in a browser. The page is just a URL (`CAPTURE_URL`); the camera does the rest.

## How it works

```
CAPTURE_URL ──▶ headless Chromium ──▶ JPEG screenshot ──▶ ffmpeg (H.264) ──▶ RTSP ──┐
(any web page)   (puppeteer)          (on an interval)                              ├─▶ NVR
                                                       └──▶ ONVIF snapshot (JPEG) ──┤
                                          ONVIF SOAP + WS-Discovery ────────────────┘
```

- **Capture** (`server/publisher/capture.ts`): puppeteer loads `CAPTURE_URL` and screenshots it.
- **Stream** (`server/publisher/stream.ts` + `server/rtsp/`): frames are piped through ffmpeg into an H.264 RTSP stream.
- **ONVIF** (`server/onvif/`): a SOAP device/media server plus WS-Discovery so NVRs auto-discover the camera; the latest frame is also served as a JPEG snapshot.

## Example use-case: weather dashboard

The original use for this project was a "weather camera": a Preact dashboard showing a live
condition-reactive forecast, served on a local port, captured and streamed as an ONVIF camera so a
forecast tile appears alongside the real cameras in Unifi Protect. Any such page works — build (or
host) the page yourself, serve it somewhere reachable, and set `CAPTURE_URL` to its address.

## Configuration

All settings are environment variables (see `.env.example`):

| Variable              | Default                  | Description                                         |
| --------------------- | ------------------------ | --------------------------------------------------- |
| `CAPTURE_URL`         | `http://localhost:8080/` | The web page the camera screenshots.                |
| `RTSP_PORT`           | `554`                    | RTSP listen port.                                   |
| `RTSP_PATH`           | `/stream`                | RTSP stream path.                                   |
| `ONVIF_PORT`          | `8020`                   | ONVIF SOAP + snapshot port.                         |
| `DEVICE_HOSTNAME`     | `localhost`              | LAN IP advertised in every ONVIF/RTSP/snapshot URL. |
| `DEVICE_MAC`          | —                        | Advertised MAC address.                             |
| `DEVICE_UUID`         | —                        | Advertised device UUID.                             |
| `DEVICE_MANUFACTURER` | `WebCapture`             | Advertised manufacturer.                            |
| `DEVICE_MODEL`        | `Camera`                 | Advertised model.                                   |

## Development

### Prerequisites

- Node.js 24+ (runs TypeScript directly via native type stripping; no build step)
- pnpm
- `ffmpeg` on your `PATH`
- Chromium/Chrome (puppeteer downloads one on install for desktop platforms)

### Run locally

```bash
pnpm install

# Serve something at CAPTURE_URL (any web page), then:
pnpm dev      # ONVIF/RTSP/capture server with --watch
```

The capturer waits for `CAPTURE_URL` to become reachable before it starts streaming.

## Production Deployment (Raspberry Pi 5)

Packaged as a Docker image for `linux/arm64` (Raspberry Pi 4/5) via `Dockerfile` +
`docker-compose.yml`. The image bundles system Chromium and ffmpeg.

**Build it natively on the Pi:** emulated cross-builds from an x86 machine are slow and unreliable
(Chromium especially).

**1. Install Docker on Raspberry Pi OS (64-bit):**

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER   # then log out / back in
```

**2. Get the code and configure `.env`:**

```bash
git clone <repo-url> web-capture-camera && cd web-capture-camera
cp .env.example .env
```

Edit `.env` and set at least:

- `CAPTURE_URL`: the page to stream. If it points at `localhost`, that page must be served in the
  same host network namespace (host networking is used).
- `DEVICE_HOSTNAME`: the Pi's LAN IP (e.g. `192.168.0.32`). Every advertised ONVIF/RTSP/snapshot
  URL is built from this, so it must be reachable by your NVR. Reserve a DHCP lease so it stays stable.
- Optional: `RTSP_PORT` (default `554`), `ONVIF_PORT` (default `8020`), and the `DEVICE_*` identity fields.

**3. Build and run:**

```bash
docker compose build      # native arm64; installing Chromium is the slow step
docker compose up -d
docker compose logs -f
```

The `camera` service uses host networking, required so ONVIF WS-Discovery multicast and the
advertised URLs work on the LAN. Services exposed on the Pi:

| Port       | Service                                   |
| ---------- | ----------------------------------------- |
| `554`      | RTSP stream: `rtsp://<pi-ip>:554/stream`  |
| `8020`     | ONVIF SOAP + snapshot (`/onvif/snapshot`) |
| `3702/udp` | WS-Discovery (device auto-discovery)      |

**4. Verify** (from another host on the same subnet):

```bash
ffprobe -rtsp_transport tcp rtsp://<pi-ip>:554/stream   # H.264 720p stream
curl -s http://<pi-ip>:8020/onvif/snapshot -o snap.jpg  # latest frame (JPEG)
```

Then add the camera in Unifi Protect via ONVIF discovery; it appears as **WebCapture Camera**.

**Updating:** `git pull && docker compose build && docker compose up -d`.

## Unifi Protect viewports

If you're integrating with Unifi Protect viewports, note the following:

- **Streams:** Every camera exposes a `main_stream` and a `sub_stream`.
- **Single view:** `main_stream` is used for full-quality display (e.g., a single camera).
- **Multi view:** The viewport uses `sub_stream` for multi-camera views; omitting the low-quality
  `sub_stream` profile causes multi-view problems (the web UI always uses `main_stream`, so it's unaffected).

## Snapshots & thumbnails

UniFi Protect displays device thumbnails and hover previews by fetching the ONVIF snapshot via
`GetSnapshotUri`. This app serves snapshots as **JPEG** (not PNG), as mandated by the
[ONVIF Media Service specification (5.16.1)](https://www.onvif.org/specs/srv/media/ONVIF-Media-Service-Spec.pdf#page=50).
The same JPEG frame feeds both the snapshot HTTP endpoint (`/onvif/snapshot`) and the H.264 RTSP
encoder, keeping the pipeline straightforward while satisfying the spec.

Without valid JPEG snapshots, UniFi Protect shows a black tile and no hover preview. If thumbnails
don't appear after adding the camera to Protect, ensure:

1. The ONVIF port (default `8020`) is reachable from your Protect controller.
2. The camera is fully adopted and ONVIF services have finished loading (may take a minute or two).
3. The snapshot endpoint returns a valid JPEG: `curl -sI http://<device-ip>:8020/onvif/snapshot` should show `Content-Type: image/jpeg`.
