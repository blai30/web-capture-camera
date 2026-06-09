import puppeteer, { type Browser, type Page } from 'puppeteer'

import { createLogger } from '../log.ts'

const logger = createLogger('capture')

const URL_READINESS_RETRIES = 30
const URL_READINESS_DELAY_MS = 2000
const WAIT_BEFORE_FIRST_CAPTURE_MS = 10_000

const CHROMIUM_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-default-apps',
  '--no-first-run',
  '--disable-extensions',
  '--disable-sync',
]

export type CapturerOptions = {
  url: string
  viewport: { width: number; height: number }
  /** How often the page is re-screenshotted into a fresh frame, in milliseconds. */
  captureIntervalMs: number
}

/**
 * Drives a headless Chromium page and turns it into JPEG frames. `start()` launches the browser,
 * loads the page, captures the first frame, then refreshes it every `captureIntervalMs`.
 * `getLatestFrame()` returns the current frame, shared by the snapshot endpoint and the encoder.
 */
export function createCapturer(options: CapturerOptions) {
  let browser: Browser | null = null
  let page: Page | null = null
  let latestFrame: Uint8Array<ArrayBufferLike> | null = null
  let captureInterval: NodeJS.Timeout | null = null

  async function start() {
    logger.info('Launching browser')
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: CHROMIUM_LAUNCH_ARGS,
    })
    logger.debug('Browser launched, opening page')

    page = await browser.newPage()
    await page.setViewport(options.viewport)
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])

    logger.info(`Waiting for ${options.url}`)
    await waitForUrl(options.url)
    logger.debug(`URL ready, navigating`)
    await page.goto(options.url, { waitUntil: 'networkidle2' })
    logger.info('Page loaded')
    // Give the page a moment to finish any initial animations/data loads
    logger.debug(`Waiting ${WAIT_BEFORE_FIRST_CAPTURE_MS}ms before first capture`)
    await new Promise((resolve) => setTimeout(resolve, WAIT_BEFORE_FIRST_CAPTURE_MS))

    await captureFrame()
    captureInterval = setInterval(() => {
      captureFrame().catch((error) => logger.error(`Capture failed: ${error}`))
    }, options.captureIntervalMs)
  }

  // Screenshot the page as JPEG and store it as the latest frame. JPEG is required by the ONVIF
  // spec for GetSnapshotUri responses (not PNG), and reused for the H.264 stream to keep one format.
  async function captureFrame() {
    if (!page) throw new Error('page renderer not started')
    latestFrame = await page.screenshot({ type: 'jpeg', quality: 90 })
    logger.debug('Captured new frame')
  }

  /**
   * The current frame, or null before the first capture. Shared by the ONVIF snapshot endpoint and
   * the encoder so both serve the exact frame the capturer last grabbed.
   */
  function getLatestFrame(): Uint8Array<ArrayBufferLike> | null {
    return latestFrame
  }

  const asyncDispose = async () => {
    if (captureInterval) clearInterval(captureInterval)
    if (browser) await browser.close()
  }

  return { start, getLatestFrame, [Symbol.asyncDispose]: asyncDispose }
}

async function waitForUrl(url: string) {
  for (let attempt = 1; attempt <= URL_READINESS_RETRIES; attempt++) {
    try {
      await fetch(url)
      return
    } catch {
      logger.debug(`Waiting for ${url}... attempt ${attempt}/${URL_READINESS_RETRIES}`)
      await new Promise((resolve) => setTimeout(resolve, URL_READINESS_DELAY_MS))
    }
  }
  throw new Error(`URL did not become ready after ${URL_READINESS_RETRIES} attempts: ${url}`)
}
