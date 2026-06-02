import { spawn } from 'child_process'

import puppeteer from 'puppeteer'

const APP_URL = 'http://vite-app:5173'
const RTSP_URL = 'rtsp://mediamtx:8554/weather'
const FRAMERATE = 1
const INTERVAL = 5000

async function main() {
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
    're',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
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

  ffmpeg.stderr.on('data', (data) => {
    console.log(`[FFMPEG] ${data.toString()}`)
  })

  setInterval(async () => {
    try {
      // Capture screenshot as a raw buffer and write to FFMPEG stdin
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 })
      ffmpeg.stdin.write(screenshotBuffer)
    } catch (err) {
      console.error('Error during frame capture:', err)
    }
  }, INTERVAL)
}

main().catch(console.error)
