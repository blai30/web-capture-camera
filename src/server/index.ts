import { readFileSync } from 'node:fs'
import { IncomingMessage, ServerResponse, createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { startCapturePipeline } from '@/server/capture'
import { startOnvifServer } from '@/server/onvif'
import { startRtspServer } from '@/server/rtsp'
import { startWsDiscovery } from '@/server/wsdiscovery'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.SERVER_PORT ?? 3000)
const RTSP_PORT = Number(process.env.RTSP_PORT ?? 554)
const WS_DISCOVERY_PORT = Number(process.env.WS_DISCOVERY_PORT ?? 3702)
const FRAME_RATE = Number(process.env.FRAME_RATE ?? 5)
const ONVIF_HOST = process.env.ONVIF_HOST ?? '0.0.0.0'
const ONVIF_DEVICE_NAME = process.env.ONVIF_DEVICE_NAME ?? 'Weather Dashboard Camera'

// Serve the built SPA
const distDir = join(__dirname, '..', '..', 'dist')
const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8')

function serveSpa(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/'
  if (url === '/' || url === '/index.html' || !url.includes('.')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(indexHtml)
    return
  }

  // Serve static assets from dist
  const filePath = join(distDir, url)
  try {
    const content = readFileSync(filePath)
    const ext = filePath.split('.').pop() ?? ''
    const types: Record<string, string> = {
      js: 'application/javascript',
      css: 'text/css',
      png: 'image/png',
      jpg: 'image/jpeg',
      svg: 'image/svg+xml',
      html: 'text/html',
    }
    res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' })
    res.end(content)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

async function main() {
  // Start ONVIF SOAP server
  const onvifServer = startOnvifServer({
    host: ONVIF_HOST,
    rtspPort: RTSP_PORT,
    deviceName: ONVIF_DEVICE_NAME,
  })

  // Start WS-Discovery responder
  startWsDiscovery({
    host: ONVIF_HOST,
    wsDiscoveryPort: WS_DISCOVERY_PORT,
  })

  // Start RTSP server
  const rtspServer = startRtspServer(RTSP_PORT)

  // Start HTTP server for SPA (must start before capture pipeline)
  const httpServer = createServer(serveSpa)
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`Weather Dashboard server running:`)
      console.log(`SPA: http://localhost:${PORT}`)
      console.log(`ONVIF: http://${ONVIF_HOST}:8000/onvif`)
      console.log(`RTSP: rtsp://${ONVIF_HOST}:${RTSP_PORT}/stream`)
      console.log(`WS-Discovery: udp://${ONVIF_HOST}:${WS_DISCOVERY_PORT}`)
      resolve()
    })
  })

  // Start Playwright capture pipeline → FFmpeg → H.264 frames fed to RTSP
  const capture = await startCapturePipeline({
    spaUrl: `http://localhost:${PORT}`,
    frameRate: FRAME_RATE,
    onFrame: (h264Nalu: Buffer) => {
      rtspServer.pushFrame(h264Nalu)
    },
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...')
    capture.stop()
    rtspServer.close()
    onvifServer.close()
    httpServer.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
