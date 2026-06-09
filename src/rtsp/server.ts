import net from 'net'

import { createLogger } from '../log.ts'
import { rtspConfig } from '../onvif/config.ts'
import { createStreamRelay } from './relay.ts'
import { createRtspSession, type StreamRelay } from './session.ts'

const logger = createLogger('rtsp')

// On shutdown, live RTSP streams never end on their own, so we wait this long for connections to
// close gracefully before force-destroying whatever is still open.
const SHUTDOWN_GRACE_MS = 5000

export function createRtspServer() {
  const relay = createStreamRelay()
  const sockets = new Set<net.Socket>()
  const server = net.createServer((socket: net.Socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    handleConnection(socket, relay)
  })

  function start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      server.on('error', reject)
      server.listen(rtspConfig.port, '0.0.0.0', () => {
        logger.info(`Server listening on port ${rtspConfig.port}`)
        resolve()
      })
    })
  }

  const asyncDispose = () =>
    new Promise<void>((resolve) => {
      // Force-close anything still streaming after the grace period. Each destroy() emits 'close',
      // which empties the set and lets server.close() complete.
      const forceTimer = setTimeout(() => {
        for (const socket of sockets) {
          socket.destroy()
        }
      }, SHUTDOWN_GRACE_MS)

      // Stop accepting new connections; resolve once every live socket has closed.
      server.close(() => {
        clearTimeout(forceTimer)
        resolve()
      })
    })

  return { start, [Symbol.asyncDispose]: asyncDispose }
}

// Adapts a TCP socket to the RtspTransport seam and forwards its bytes into a session. All RTSP
// protocol handling lives in the session; this function is only socket plumbing.
function handleConnection(socket: net.Socket, relay: StreamRelay) {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`
  logger.debug(`Connection from ${remote}`)

  socket.setKeepAlive(true, 15000)
  socket.setNoDelay(true)

  const session = createRtspSession(
    {
      write: (bytes) => socket.write(bytes),
      onDrain: (callback) => socket.once('drain', callback),
      end: () => socket.end(),
    },
    relay,
    { remoteLabel: remote }
  )

  socket.on('data', (raw: Buffer) => session.receive(raw))

  socket.on('error', () => {
    session.close()
  })

  socket.on('close', () => {
    logger.debug(`Connection closed: ${remote}${session.isPublisher ? ' (publisher)' : ''}`)
    session.close()
  })
}
