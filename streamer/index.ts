import { spawn, ChildProcess } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { join, extname } from 'node:path'

import { chromium } from 'playwright'

// --- Config from environment ---

const DEFAULT_LAT = 40.7128
const DEFAULT_LON = -74.006
const DEFAULT_NAME = 'New York'

const DASHBOARD_DIR = process.env.DASHBOARD_DIR ?? '../dist'
const FRAME_RATE = parseInt(process.env.FRAME_RATE ?? '5', 10)
const RTSP_URL = process.env.RTSP_URL ?? 'rtsp://localhost:8554/weather'
const VIEWPORT_WIDTH = 1920
const VIEWPORT_HEIGHT = 1080
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL ?? '600000', 10)

// --- Static file server for the built dashboard ---

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function serveFile(res: ServerResponse, filePath: string): void | never {
  const mimeType = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream'
  const content = readFileSync(filePath)
  res.writeHead(200, { 'Content-Type': mimeType })
  res.end(content)
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const urlPath = req.url ?? '/'
  // Strip query string
  const pathWithoutQuery = urlPath.split('?')[0]

  // Serve runtime config for the dashboard
  if (pathWithoutQuery === '/config.json') {
    const lat = parseFloat(import.meta.env.VITE_WEATHER_LAT ?? '')
    const lon = parseFloat(import.meta.env.VITE_WEATHER_LON ?? '')
    const config = {
      latitude: isNaN(lat) ? DEFAULT_LAT : lat,
      longitude: isNaN(lon) ? DEFAULT_LON : lon,
      name: import.meta.env.VITE_WEATHER_NAME ?? DEFAULT_NAME,
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(config))
    return
  }

  const servePath = pathWithoutQuery === '/' ? '/index.html' : pathWithoutQuery
  const filePath = join(DASHBOARD_DIR, servePath)

  try {
    statSync(filePath)
    serveFile(res, filePath)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})

// --- Frame capture pipeline ---

let ffmpegProcess: ChildProcess | null = null
let isShuttingDown = false

function startFfmpeg(): ChildProcess {
  const frameIntervalMs = 1000 / FRAME_RATE

  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'warning',
      // Input: JPEG image sequence from stdin
      '-framerate',
      String(FRAME_RATE),
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-i',
      '-',
      // Output: H.264 encoded, push to RTSP
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-pix_fmt',
      'yuv420p',
      '-f',
      'rtsp',
      '-rtsp_transport',
      'tcp',
      RTSP_URL,
    ],
    {
      stdio: ['pipe', 'inherit', 'inherit'],
    }
  )

  ffmpeg.on('error', (error) => {
    console.error('[ffmpeg] Process error:', error.message)
  })

  ffmpeg.on('close', (code) => {
    if (!isShuttingDown) {
      console.warn(`[ffmpeg] Exited with code ${code}`)
    }
  })

  console.log(`[ffmpeg] Started → ${RTSP_URL} @ ${FRAME_RATE}fps`)
  return ffmpeg
}

async function captureAndStreamFrames(pageUrl: string): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox'],
  })

  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()

  // Navigate to the dashboard
  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 15000 })
  console.log(`[browser] Loaded dashboard at ${pageUrl}`)

  // Start ffmpeg and pipe frames
  ffmpegProcess = startFfmpeg()
  const stdin = ffmpegProcess.stdin

  const frameIntervalMs = 1000 / FRAME_RATE
  let frameCount = 0

  // Periodically reload the page to refresh weather data
  const reloadTimer = setInterval(async () => {
    try {
      console.log('[browser] Reloading dashboard...')
      await page.reload({ waitUntil: 'networkidle', timeout: 15000 })
    } catch (error) {
      console.error('[browser] Reload failed:', error)
    }
  }, REFRESH_INTERVAL_MS)
  reloadTimer.unref()

  // Main frame capture loop
  const captureLoop = async () => {
    while (!isShuttingDown) {
      try {
        const screenshotBuffer = await page.screenshot({
          type: 'jpeg',
          quality: 85,
        })
        stdin.write(screenshotBuffer)
        frameCount++
      } catch (error) {
        console.error('[browser] Screenshot failed:', error)
      }
      // Sleep for frame interval
      await new Promise((resolve) => setTimeout(resolve, frameIntervalMs))
    }
  }

  await captureLoop()
}

// --- Graceful shutdown ---

async function shutdown(): Promise<void> {
  isShuttingDown = true
  console.log('\n[streamer] Shutting down...')

  if (ffmpegProcess) {
    ffmpegProcess.stdin.end()
    ffmpegProcess.kill('SIGTERM')
    ffmpegProcess = null
  }

  httpServer.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// --- Main ---

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Weather Camera Streamer            ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`  Dashboard:  file://${DASHBOARD_DIR}`)
  console.log(`  RTSP URL:   ${RTSP_URL}`)
  console.log(`  Frame rate: ${FRAME_RATE} fps`)
  console.log(`  Viewport:   ${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}`)
  console.log(`  Refresh:    ${REFRESH_INTERVAL_MS / 1000}s`)
  console.log('')

  // Start static file server
  const PORT = 3456
  httpServer.listen(PORT, () => {
    console.log(`[http] Dashboard served at http://localhost:${PORT}`)
  })

  // Wait a moment for server to start, then begin streaming
  await new Promise((resolve) => setTimeout(resolve, 1000))

  try {
    await captureAndStreamFrames(`http://localhost:${PORT}`)
  } catch (error) {
    console.error('[streamer] Fatal error:', error)
    await shutdown()
  }
}

main()
