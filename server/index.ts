import 'dotenv/config'
import { rtspConfig } from './onvif/config'
import { createOnvifDevice } from './onvif/device'
import { createWsDiscovery } from './onvif/discovery'
import { createOnvifServer } from './onvif/server'
import { createCapturer } from './publisher/capture'
import { createStream } from './publisher/stream'
import { createRtspServer } from './rtsp/server'

const APP_URL = 'http://localhost:5173'
// Must be 127.0.0.1 due to IPv4 binding;
// localhost may resolve to ::1 IPv6 which causes ffmpeg to fail to connect
const RTSP_URL = `rtsp://127.0.0.1:${rtspConfig.port}${rtspConfig.path}`
const CAPTURE_INTERVAL_MS = 600_000

async function main() {
  await using rtsp = createRtspServer()
  await rtsp.start()

  const device = createOnvifDevice()

  await using capturer = createCapturer({
    url: APP_URL,
    viewport: { width: 1280, height: 720 },
  })

  await using onvif = createOnvifServer(device, {
    snapshotSource: () => capturer.getLatestFrame(),
  })
  await onvif.start()

  await using discovery = createWsDiscovery(device)
  discovery.start()

  await capturer.start()

  await using stream = createStream({
    rtspUrl: RTSP_URL,
    source: () => capturer.captureFrame(),
    captureIntervalMs: CAPTURE_INTERVAL_MS,
  })
  await stream.start()

  const controller = new AbortController()
  process.on('SIGINT', () => controller.abort())
  process.on('SIGTERM', () => controller.abort())

  await new Promise((resolve) => controller.signal.addEventListener('abort', resolve))
}

main().catch(console.error)
