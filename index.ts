import { spawn } from 'child_process'
import { mkdirSync } from 'fs'

import puppeteer from 'puppeteer'

const APP_URL = 'http://vite-app:5173'
const RTSP_URL = 'rtsp://mediamtx:8554/weather'
const FRAME_DIR = '/tmp/frames'
const FRAMERATE = 1
const CAPTURE_INTERVAL_MS = 10_000

async function main() {
  mkdirSync(FRAME_DIR, { recursive: true })

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })

  // Wait for Vite dev server to be ready
  let retries = 0
  while (retries < 30) {
    try {
      await fetch(APP_URL)
      break
    } catch {
      retries++
      console.log(`Waiting for Vite server... attempt ${retries}/30`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  await page.goto(APP_URL, { waitUntil: 'networkidle2' })

  // Spawn FFMPEG to read from stdin (image2pipe) and output to RTSP using libx264
  // oxfmt-ignore
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', FRAMERATE.toString(),
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'ultrafast',
    '-tune', 'stillimage',
    '-f', 'rtsp',
    '-rtsp_transport', 'tcp',
    RTSP_URL
  ]);

  let stderrBuffer = ''
  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString()
    stderrBuffer += msg
    console.log(`[FFmpeg] ${msg.trim()}`)
  })

  ffmpeg.stderr.on('data', (data) => {
    console.log(`[FFMPEG] ${data.toString()}`)
  })

  // Capture a new frame at the configured interval
  setInterval(async () => {
    try {
      const startTime = Date.now()

      // Capture screenshot as a raw buffer
      const screenshotBuffer = await page.screenshot({ type: 'png' })

      // Write buffer to FFMPEG stdin
      ffmpeg.stdin.write(screenshotBuffer)

      // Dynamically calculate sleep time to maintain target FPS
      const elapsed = Date.now() - startTime
      const sleepTime = Math.max(0, 1000 / FRAMERATE - elapsed)
      await new Promise((resolve) => setTimeout(resolve, sleepTime))
    } catch (err) {
      console.error('Error during frame capture:', err)
    }
  }, CAPTURE_INTERVAL_MS)
}

main().catch(console.error)
