import { spawn, type ChildProcess } from 'child_process'

import { createLogger } from '../log'

const logger = createLogger('stream')

const PUSH_INTERVAL_MS = 1000

export type FrameSource = () => Promise<Uint8Array<ArrayBufferLike>>

export type StreamOptions = {
  rtspUrl: string
  source: FrameSource
  captureIntervalMs: number
}

export function createStream(options: StreamOptions) {
  let ffmpeg: ChildProcess | null = null
  let captureInterval: NodeJS.Timeout | null = null
  let pushInterval: NodeJS.Timeout | null = null
  let latestFrame: Uint8Array<ArrayBufferLike> | null = null

  async function start() {
    logger.info(`Spawning ffmpeg, target: ${options.rtspUrl}`)
    // oxfmt-ignore
    ffmpeg = spawn('ffmpeg', [
      // Input: JPEG frames via stdin at 1 fps.
      // We use JPEG codec (mjpeg) here to match the snapshot format;
      // this keeps the pipeline simple even though H.264 stream encoding could accept other formats.
      // JPEG is required by ONVIF spec for snapshots.
      '-f', 'image2pipe',
      '-loop', '1',
      '-c:v', 'mjpeg',
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
      '-r', '1',
      '-g', '10',
      // Output: RTSP ANNOUNCE to our own server
      '-f', 'rtsp',
      '-rtsp_transport', 'tcp',
      options.rtspUrl,
    ])

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      logger.debug(data.toString().trimEnd())
    })
    ffmpeg.on('error', (error: Error) => {
      logger.error(`ffmpeg spawn error: ${error.message}`)
    })
    ffmpeg.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      logger.info(`ffmpeg exited (code=${code}, signal=${signal})`)
    })

    const captureFrame = async () => {
      latestFrame = await options.source()
      logger.debug('Captured new frame')
    }

    await captureFrame()
    captureInterval = setInterval(captureFrame, options.captureIntervalMs)
    pushInterval = setInterval(() => {
      if (latestFrame && ffmpeg && !ffmpeg.stdin?.destroyed) {
        ffmpeg.stdin?.write(latestFrame, () => {})
      }
    }, PUSH_INTERVAL_MS)
  }

  const asyncDispose = async () => {
    if (captureInterval) clearInterval(captureInterval)
    if (pushInterval) clearInterval(pushInterval)
    if (ffmpeg) ffmpeg.kill()
  }

  return { start, [Symbol.asyncDispose]: asyncDispose }
}
