import 'dotenv/config'
import { createLogger } from './log.ts'
import { rtspConfig } from './onvif/config.ts'
import { createOnvifDevice } from './onvif/device.ts'
import { createWsDiscovery } from './onvif/discovery.ts'
import { createOnvifServer } from './onvif/server.ts'
import { createCapturer } from './publisher/capture.ts'
import { createStream } from './publisher/stream.ts'
import { createRtspServer } from './rtsp/server.ts'

// Must be 127.0.0.1 due to IPv4 binding;
// localhost may resolve to ::1 IPv6 which causes ffmpeg to fail to connect
const RTSP_URL = `rtsp://127.0.0.1:${rtspConfig.port}${rtspConfig.path}`
const CAPTURE_INTERVAL_MS = 600_000

// The URL the capturer screenshots. Any web page served anywhere reachable from this process
// (a static host, an app on the LAN, localhost) works; supply it via CAPTURE_URL.
const CAPTURE_URL = process.env.CAPTURE_URL ?? 'http://localhost:8080/'

const logger = createLogger('main')

async function main() {
  await using rtsp = createRtspServer()
  await rtsp.start()

  const device = createOnvifDevice()

  await using capturer = createCapturer({
    url: CAPTURE_URL,
    viewport: { width: 1280, height: 720 },
    captureIntervalMs: CAPTURE_INTERVAL_MS,
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
    source: () => capturer.getLatestFrame(),
  })
  await stream.start()

  const controller = new AbortController()
  process.on('SIGINT', () => controller.abort())
  process.on('SIGTERM', () => controller.abort())

  await new Promise((resolve) => controller.signal.addEventListener('abort', resolve))
}

main().catch((error) => logger.error(error))
