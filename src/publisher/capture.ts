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
}

/**
 * Drives a headless Chromium page and turns it into JPEG frames. Call `start()` to launch the
 * browser and load the page, then `captureFrame()` to grab a fresh frame; `getLatestFrame()`
 * returns the last grabbed one without re-screenshotting.
 */
export function createCapturer(options: CapturerOptions) {
  let browser: Browser | null = null
  let page: Page | null = null
  let latestFrame: Uint8Array<ArrayBufferLike> | null = null

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
  }

  /**
   * Screenshot the page as JPEG, store it as the latest frame, and return it.
   * @throws if called before `start()` has loaded the page.
   */
  async function captureFrame() {
    if (!page) throw new Error('page renderer not started')
    // JPEG is required by ONVIF spec for GetSnapshotUri responses (not PNG).
    // Capture as JPEG for both the snapshot endpoint and H.264 stream to keep the pipeline simple.
    latestFrame = await page.screenshot({ type: 'jpeg', quality: 90 })
    return latestFrame
  }

  /**
   * The most recently captured frame, or null before the first capture. Shared with the ONVIF
   * snapshot endpoint so a snapshot serves the exact frame already going out over the stream.
   */
  function getLatestFrame(): Uint8Array<ArrayBufferLike> | null {
    return latestFrame
  }

  const asyncDispose = async () => {
    if (browser) await browser.close()
  }

  return { start, captureFrame, getLatestFrame, [Symbol.asyncDispose]: asyncDispose }
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
