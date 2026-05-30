import { readFileSync } from 'node:fs'
import { IncomingMessage, ServerResponse, createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { startCapturePipeline } from './capture'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.SERVER_PORT ?? 5173)
const FRAME_RATE = Number(process.env.FRAME_RATE ?? 5)
const MEDIAMTX_URL = process.env.MEDIAMTX_RTSP_URL ?? 'rtsp://localhost:8554/live'

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
  // Start HTTP server for SPA (must start before capture pipeline)
  const httpServer = createServer(serveSpa)
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`Weather Dashboard server running:`)
      console.log(`SPA: http://localhost:${PORT}`)
      console.log(`MediaMTX RTSP: ${MEDIAMTX_URL}`)
      resolve()
    })
  })

  // Start Playwright capture pipeline → FFmpeg → RTSP push to MediaMTX
  const capture = await startCapturePipeline({
    spaUrl: `http://localhost:${PORT}`,
    frameRate: FRAME_RATE,
    mediamtxUrl: MEDIAMTX_URL,
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...')
    capture.stop()
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
