import net from 'net'

import { createLogger } from '../log.ts'
import { rtspConfig } from '../onvif/config.ts'
import { createStreamRelay, PublisherBusyError, type SubscriberHandle } from './relay.ts'

const logger = createLogger('rtsp')

const CRLF = '\r\n'

// On shutdown, live RTSP streams never end on their own, so we wait this long for connections to
// close gracefully before force-destroying whatever is still open.
const SHUTDOWN_GRACE_MS = 5000

type StreamRelay = ReturnType<typeof createStreamRelay>

type RtspRequest = {
  method: string
  uri: string
  headers: Record<string, string>
  body: string
}

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

function handleConnection(socket: net.Socket, relay: StreamRelay) {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`
  logger.debug(`Connection from ${remote}`)

  socket.setKeepAlive(true, 15000)
  socket.setNoDelay(true)

  let buffer = ''
  let isPublisher = false
  let sessionId = ''
  let handle: SubscriberHandle | null = null

  function sendResponse(
    cseq: string,
    status: string,
    extraHeaders: Record<string, string> = {},
    body?: string
  ) {
    const headers = [`CSeq: ${cseq}`, 'User-Agent: WeatherDash-RTSP']
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.push(`${key}: ${value}`)
    }
    if (body) {
      headers.push('Content-Type: application/sdp')
      headers.push(`Content-Length: ${Buffer.byteLength(body)}`)
    }
    const response = `RTSP/1.0 ${status}${CRLF}${headers.join(CRLF)}${CRLF}${CRLF}${body ?? ''}`
    socket.write(response)
  }

  function routeOptions(cseq: string) {
    sendResponse(cseq, '200 OK', {
      Public: 'DESCRIBE, ANNOUNCE, SETUP, PLAY, TEARDOWN, OPTIONS, GET_PARAMETER, SET_PARAMETER',
    })
  }

  function routeAnnounce(
    cseq: string,
    uri: string,
    _headers: Record<string, string>,
    body: string
  ) {
    // Defensive: if this same socket had previously SETUP'd as a subscriber, clear that record
    // before it becomes the publisher. Not part of any real client flow, but cheap.
    if (handle) {
      handle.detach()
      handle = null
    }

    try {
      relay.attachPublisher(body)
    } catch (error) {
      if (error instanceof PublisherBusyError) {
        logger.warn(`ANNOUNCE rejected from ${remote}: publisher already attached`)
        sendResponse(cseq, '503 Service Unavailable')
        return
      }
      throw error
    }

    isPublisher = true
    logger.info(`ANNOUNCE from ${remote} on ${uri}`)
    sendResponse(cseq, '200 OK')
  }

  function routeDescribe(cseq: string) {
    const sdp = relay.getSdp()
    if (!sdp) {
      logger.debug('DESCRIBE rejected: no publisher SDP yet')
      sendResponse(cseq, '404 Not Found')
      return
    }
    logger.debug(`Returning SDP (${sdp.length} chars)`)
    sendResponse(cseq, '200 OK', { 'Cache-Control': 'no-cache' }, sdp)
  }

  function routeSetup(cseq: string, _uri: string, headers: Record<string, string>) {
    const transport = headers['transport'] ?? ''
    const match = transport.match(/interleaved=(\d+)-(\d+)/)
    sessionId = generateSessionId()

    let rtpChannel = 0
    if (match) {
      rtpChannel = parseInt(match[1], 10)
      handle = relay.addSubscriber({
        write: (bytes) => socket.write(bytes),
        onDrain: (callback) => socket.once('drain', callback),
        rtpChannel,
      })
    }

    sendResponse(cseq, '200 OK', {
      Transport: 'RTP/AVP/TCP;unicast;interleaved=' + rtpChannel + '-' + (rtpChannel + 1),
      Session: sessionId,
    })
  }

  function routePlay(cseq: string, uri: string) {
    handle?.play()
    sendResponse(cseq, '200 OK', {
      Session: sessionId,
      'RTP-Info': `url=${uri};seq=0;rtptime=0`,
    })
  }

  function routeRecord(cseq: string, uri: string) {
    logger.debug(`RECORD ${uri}`)
    sendResponse(cseq, '200 OK', { Session: sessionId })
    socket.removeListener('data', onData)
    socket.on('data', (chunk: Buffer) => relay.pushPublisherBytes(chunk))
  }

  function routeTeardown(cseq: string) {
    handle?.detach()
    handle = null
    sendResponse(cseq, '200 OK')
    socket.end()
  }

  function routeGetParameter(cseq: string) {
    sendResponse(cseq, '200 OK', { Session: sessionId })
  }

  const routes: Record<
    string,
    (cseq: string, uri: string, headers: Record<string, string>, body: string) => void
  > = {
    OPTIONS: routeOptions,
    ANNOUNCE: routeAnnounce,
    DESCRIBE: routeDescribe,
    SETUP: routeSetup,
    PLAY: routePlay,
    RECORD: routeRecord,
    TEARDOWN: routeTeardown,
    GET_PARAMETER: routeGetParameter,
    SET_PARAMETER: routeGetParameter,
  }

  function onRequest(method: string, uri: string, headers: Record<string, string>, body: string) {
    const cseq = headers['cseq'] ?? '0'
    logger.debug(`${method} ${uri} (CSeq: ${cseq}) from ${remote}`)

    const handler = routes[method]
    if (handler) {
      handler(cseq, uri, headers, body)
    } else {
      sendResponse(cseq, '501 Not Implemented')
    }
  }

  function onData(raw: Buffer) {
    buffer += raw.toString('ascii')

    const { requests, rest } = frameRtspRequests(buffer)
    buffer = rest

    for (const request of requests) {
      try {
        onRequest(request.method, request.uri, request.headers, request.body)
      } catch {
        sendResponse(request.headers['cseq'] ?? '0', '500 Internal Error')
      }
    }
  }

  socket.on('data', onData)

  socket.on('error', () => {
    if (isPublisher) relay.detachPublisher()
    handle?.detach()
    handle = null
  })

  socket.on('close', () => {
    logger.debug(`Connection closed: ${remote}${isPublisher ? ' (publisher)' : ''}`)
    if (isPublisher) relay.detachPublisher()
    handle?.detach()
    handle = null
  })
}

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const lines = text.split('\r\n')
  for (const line of lines.slice(1)) {
    const index = line.indexOf(':')
    if (index === -1) continue
    const key = line.substring(0, index).trim().toLowerCase()
    const value = line.substring(index + 1).trim()
    headers[key] = value
  }
  return headers
}

// Consumes as many complete RTSP requests as the buffer holds, returning them along with the
// unconsumed remainder. A malformed request line drops the entire buffer (matching the prior
// inline behavior); an incomplete request is left in `rest` for the next chunk.
function frameRtspRequests(buffer: string): { requests: RtspRequest[]; rest: string } {
  const requests: RtspRequest[] = []
  let rest = buffer

  while (true) {
    const headerEnd = rest.indexOf(CRLF + CRLF)
    if (headerEnd === -1) break

    const headerText = rest.substring(0, headerEnd)
    const lines = headerText.split('\r\n')
    const parts = lines[0].split(' ')
    if (parts.length < 3) {
      return { requests, rest: '' }
    }
    const method = parts[0]
    const uri = parts[1]

    const headers = parseHeaders(headerText)
    const bodyLength = parseInt(headers['content-length'] ?? '0', 10)

    const afterHeaders = headerEnd + 4
    if (rest.substring(afterHeaders).length < bodyLength) break

    const body = rest.substring(afterHeaders, afterHeaders + bodyLength)
    rest = rest.substring(afterHeaders + bodyLength)

    requests.push({ method, uri, headers, body })
  }

  return { requests, rest }
}

function generateSessionId(): string {
  return Math.random().toString(16).slice(2, 10)
}
