import { spawn } from 'node:child_process'

import { chromium } from 'playwright'

interface CaptureConfig {
  spaUrl: string
  frameRate: number
  mediamtxUrl: string
}

export async function startCapturePipeline(
  config: CaptureConfig
): Promise<{ stop: () => Promise<void> }> {
  const { spaUrl, frameRate, mediamtxUrl } = config

  // Launch headless Chromium
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()

  // Navigate to the SPA
  await page.goto(spaUrl, { waitUntil: 'networkidle', timeout: 15000 })
  console.log('Playwright: SPA loaded')

  // Connect to CDP session for screencast
  // We'll capture the SPA by taking periodic screenshots (JPEG) instead of
  // relying on the Chrome screencast CDP event, which can be unreliable in
  // some headless environments. This is simpler and more deterministic.
  // FFmpeg process: JPEG pipe → RTSP push to MediaMTX
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-r',
      String(frameRate),
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-pix_fmt',
      'yuv420p',
      '-bf',
      '0',
      '-g',
      String(frameRate * 2), // IDR frame every 2 seconds
      '-f',
      'rtsp',
      '-rtsp_transport',
      'tcp',
      mediamtxUrl,
    ],
    {
      stdio: ['pipe', 'inherit', 'inherit'],
    }
  )

  const stdin = ffmpeg.stdin!

  // Screenshot-based capture loop
  let capturing = true
  let frameIndex = 0

  const captureLoop = async () => {
    const intervalMs = Math.max(20, Math.round(1000 / frameRate))
    while (capturing) {
      try {
        const buffer = await page.screenshot({ type: 'jpeg', quality: 80 })
        if (buffer && buffer.length > 0) {
          stdin.write(buffer)
          frameIndex += 1
          if (frameIndex % 30 === 0) {
            console.log('Capture: frame', frameIndex, 'size', buffer.length)
          }
        }
      } catch (err) {
        console.error('Screenshot capture error:', err)
      }

      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }

  captureLoop()

  // Handle FFmpeg events
  ffmpeg.on('error', (err) => {
    console.error('FFmpeg error:', err)
  })

  ffmpeg.on('close', (code) => {
    console.log(`FFmpeg exited with code ${code}`)
  })

  return {
    stop: async () => {
      // Stop the screenshot capture loop and terminate ffmpeg + browser
      capturing = false
      // allow the loop to unwind and flush the last frame
      await new Promise((r) => setTimeout(r, 100))
      stdin.end()
      ffmpeg.kill('SIGTERM')
      await browser.close()
    },
  }
}
