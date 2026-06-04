import 'dotenv/config'
import { spawn, ChildProcess } from 'child_process'

import puppeteer, { Browser } from 'puppeteer'

import { rtspConfig } from './onvif/config'
import { createWsDiscovery } from './onvif/discovery'
import { createOnvifServer } from './onvif/server'
import { createRtspServer } from './rtsp/server'

const APP_URL = 'http://localhost:5173'
// Must be 127.0.0.1 due to IPv4 binding, localhost may resolve to ::1 IPv6 which causes ffmpeg to fail to connect
const RTSP_URL = `rtsp://127.0.0.1:${rtspConfig.port}${rtspConfig.path}`
const FRAMERATE = 1
const INTERVAL = 600_000

async function main() {
  await using rtsp = createRtspServer()
  await rtsp.start()

  await using onvif = createOnvifServer()
  await onvif.start()

  await using discovery = createWsDiscovery()
  discovery.start()

  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-default-apps',
      '--no-first-run',
      '--disable-extensions',
      '--disable-sync',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])

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
  const ffmpeg: ChildProcess = spawn('ffmpeg', [
    // Input: JPEG frames via stdin
    '-f', 'image2pipe',
    '-loop', '1',
    '-c:v', 'png',
    '-framerate', '1',
    '-i', 'pipe:0',
    // Video filter pixel format
    '-pix_fmt', 'yuv420p',
    // Encoder
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level', '3.1',
    '-preset', 'ultrafast',
    '-tune', 'stillimage',
    // Bitrate
    '-b:v', '1000k',
    // Output rate
    '-r', FRAMERATE.toString(),
    '-g', '10',
    // Output: RTSP ANNOUNCE to our own server
    '-f', 'rtsp',
    '-rtsp_transport', 'tcp',
    RTSP_URL,
  ])

  ffmpeg.stderr?.on('data', (data) => {
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
  const captureInterval = setInterval(writeFrame, INTERVAL)
  const pushInterval = setInterval(() => {
    if (latestFrame && !ffmpeg.stdin?.destroyed) {
      ffmpeg.stdin?.write(latestFrame, () => {})
    }
  }, 1000)

  const controller = new AbortController()
  process.on('SIGINT', () => controller.abort())
  process.on('SIGTERM', () => controller.abort())

  await new Promise((resolve) => controller.signal.addEventListener('abort', resolve))

  clearInterval(captureInterval)
  clearInterval(pushInterval)
  ffmpeg.kill()
  await browser.close()
}

main().catch(console.error)
