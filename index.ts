import { spawn } from 'child_process'

import puppeteer from 'puppeteer'

const APP_URL = 'http://vite-app:5173'
const RTSP_URL = 'rtsp://mediamtx:8554/weather'
const FRAMERATE = 10
const INTERVAL = 60_000

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
    '-f', 'image2pipe',
    '-loop', '1',
    '-c:v', 'png',
    '-framerate', '1',
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-color_range', '1',
    '-preset', 'ultrafast',
    '-tune', 'stillimage',
    '-r', FRAMERATE.toString(),
    '-g', (FRAMERATE * 2).toString(),
    '-f', 'rtsp',
    '-rtsp_transport', 'tcp',
    RTSP_URL
  ]);

  ffmpeg.stderr.on('data', (data) => {
    console.log(`[FFMPEG] ${data.toString()}`)
  })

  let latestFrame: Buffer | Uint8Array<ArrayBufferLike> | null = null
  const writeFrame = async () => {
    const screenshot = await page.screenshot({ type: 'png' })
    latestFrame = screenshot
    console.log(`Captured new frame at ${new Date().toISOString()}`)
  }

  // Capture new screenshot every 60 seconds
  await writeFrame()
  setInterval(writeFrame, INTERVAL)

  // Push to ffmpeg stdin at 1 fps to keep stream alive
  setInterval(() => {
    if (latestFrame && !ffmpeg.stdin.destroyed) {
      const success = ffmpeg.stdin.write(latestFrame)
      if (!success) ffmpeg.stdin.once('drain', () => {})
    }
  }, 1000)
}

main().catch(console.error)
