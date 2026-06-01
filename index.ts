import { spawn } from 'child_process'

import puppeteer from 'puppeteer'

async function main() {
  const browser = await puppeteer.launch({
    headless: false, // Must be false so Xvfb renders it to the virtual buffer
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })

  const appUrl = 'http://vite-app:5173'
  const rtspUrl = 'rtsp://mediamtx:8554/weather'

  // Wait for Vite dev server to be ready
  let retries = 0
  while (retries < 30) {
    try {
      await fetch(appUrl)
      break
    } catch {
      retries++
      console.log(`Waiting for Vite server... attempt ${retries}/30`)
      await new Promise((retry) => setTimeout(retry, 2000))
    }
  }

  await page.goto(appUrl, { waitUntil: 'networkidle2' })

  console.log('Vite app loaded in headless buffer. Starting FFmpeg encoding...')

  // Use x11grab to capture the Xvfb virtual screen (:99)
  const ffmpegArgs = [
    '-f',
    'x11grab',
    '-video_size',
    '1920x1080',
    '-framerate',
    '5', // Low FPS to prevent high Raspberry Pi CPU utilization
    '-i',
    ':99.0',
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
    rtspUrl,
  ]

  const ffmpeg = spawn('ffmpeg', ffmpegArgs)
  ffmpeg.stderr.on('data', (data) => console.log(`[FFmpeg] ${data.toString()}`))
}

main().catch(console.error)
