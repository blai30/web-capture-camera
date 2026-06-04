import { spawn, type ChildProcess } from 'child_process'

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
    console.log(`[Stream] Spawning ffmpeg, target: ${options.rtspUrl}`)
    // oxfmt-ignore
    ffmpeg = spawn('ffmpeg', [
      // Input: PNG frames via stdin at 1 fps
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
      '-r', '1',
      '-g', '10',
      // Output: RTSP ANNOUNCE to our own server
      '-f', 'rtsp',
      '-rtsp_transport', 'tcp',
      options.rtspUrl,
    ])

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      console.log(`[FFMPEG] ${data.toString()}`)
    })
    ffmpeg.on('error', (error: Error) => {
      console.error(`[Stream] ffmpeg spawn error: ${error.message}`)
    })
    ffmpeg.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      console.log(`[Stream] ffmpeg exited (code=${code}, signal=${signal})`)
    })

    const captureFrame = async () => {
      latestFrame = await options.source()
      console.log(`Captured new frame at ${new Date().toISOString()}`)
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
