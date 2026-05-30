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
  const cdpSession = await context.newCDPSession(page)

  // Enable screencast
  await cdpSession.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 80,
    everyNthFrame: 1,
  })

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

  // Handle screencast frames
  cdpSession.on('Page.screencastFrame', async (event) => {
    try {
      // Convert base64 to binary
      const frameBuffer = Buffer.from(event.data, 'base64')
      stdin.write(frameBuffer)

      // Acknowledge frame to keep stream flowing
      await cdpSession.send('Page.screencastFrameAck', {
        sessionId: event.sessionId,
      })
    } catch (err) {
      console.error('Screencast frame error:', err)
    }
  })

  // Handle FFmpeg events
  ffmpeg.on('error', (err) => {
    console.error('FFmpeg error:', err)
  })

  ffmpeg.on('close', (code) => {
    console.log(`FFmpeg exited with code ${code}`)
  })

  return {
    stop: async () => {
      await cdpSession.send('Page.stopScreencast')
      stdin.end()
      ffmpeg.kill('SIGTERM')
      await browser.close()
    },
  }
}
