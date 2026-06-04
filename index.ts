import 'dotenv/config'
import { spawn } from 'child_process'

import puppeteer from 'puppeteer'

import { rtspConfig } from './src/onvif/config'
import { WsDiscovery } from './src/onvif/discovery'
import { OnvifServer } from './src/onvif/server'
import { createRtspServer } from './src/rtsp/server'

const APP_URL = 'http://localhost:5173'
const RTSP_URL = `rtsp://localhost:${rtspConfig.port}${rtspConfig.path}`
const FRAMERATE = 1
const INTERVAL = 600_000

async function main() {
  const rtsp = createRtspServer()
  await rtsp.start()

  const onvif = new OnvifServer()
  await onvif.start()

  const discovery = new WsDiscovery()
  discovery.start()

  const browser = await puppeteer.launch({
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
  const ffmpeg = spawn('ffmpeg', [
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
    RTSP_URL
  ])

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
      ffmpeg.stdin.write(latestFrame, () => {})
    }
  }, 1000)
}

main().catch(console.error)
