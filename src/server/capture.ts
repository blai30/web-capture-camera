import { spawn } from 'node:child_process'

import { chromium } from 'playwright'

interface CaptureConfig {
  spaUrl: string
  frameRate: number
  onFrame: (h264Nalu: Buffer) => void
}

interface CapturePipeline {
  stop: () => void
}

// H.264 NALU start code
const START_CODE = Buffer.from([0x00, 0x00, 0x00, 0x01])

// Parse raw H.264 byte stream into individual NALUs
function parseNalus(data: Buffer): Buffer[] {
  const nalus: Buffer[] = []
  let start = 0

  while (start < data.length) {
    // Find next start code
    const idx = data.indexOf(START_CODE, start)
    if (idx === -1) break

    start = idx + START_CODE.length

    // Find the next start code (end of this NALU)
    const nextIdx = data.indexOf(START_CODE, start)
    const end = nextIdx === -1 ? data.length : nextIdx

    if (end > start) {
      nalus.push(data.subarray(start, end))
    }
  }

  return nalus
}

export async function startCapturePipeline(config: CaptureConfig): Promise<CapturePipeline> {
  const { spaUrl, frameRate, onFrame } = config

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

  // FFmpeg process: JPEG pipe → raw H.264 pipe
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
      '-f',
      'h264',
      '-bf',
      '0',
      '-g',
      String(frameRate * 2), // IDR frame every 2 seconds
      'pipe:1',
    ],
    {
      stdio: ['pipe', 'pipe', 'inherit'],
    }
  )

  const stdin = ffmpeg.stdin!
  const stdout = ffmpeg.stdout!

  // Buffer for partial H.264 data
  let h264Buffer = Buffer.alloc(0)

  stdout.on('data', (chunk: Buffer) => {
    h264Buffer = Buffer.concat([h264Buffer, chunk])
    const nalus = parseNalus(h264Buffer)

    // Calculate how many bytes were consumed by complete NALUs
    let consumedBytes = 0
    for (const nalu of nalus) {
      onFrame(Buffer.concat([START_CODE, nalu]))
      consumedBytes += nalu.length + START_CODE.length
    }

    // Retain any trailing partial data that couldn't form a complete NALU
    if (consumedBytes > 0 && consumedBytes < h264Buffer.length) {
      h264Buffer = h264Buffer.subarray(consumedBytes)
    } else if (consumedBytes >= h264Buffer.length) {
      h264Buffer = Buffer.alloc(0)
    }
  })

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
