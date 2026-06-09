import { createLogger } from '../log.ts'
import { createStreamRelay, PublisherBusyError, type SubscriberHandle } from './relay.ts'

const logger = createLogger('rtsp')

const CRLF = '\r\n'

export type StreamRelay = ReturnType<typeof createStreamRelay>

/**
 * Everything the session needs from the underlying connection. The net.Socket satisfies this in
 * production; an in-memory recorder satisfies it in tests. This is the seam that makes the whole
 * RTSP state machine driveable without a real socket.
 */
export type RtspTransport = {
  /** Send response or RTP bytes to the peer. Returns false when the write buffer is full. */
  write: (bytes: Buffer | string) => boolean
  /** Register a one-shot callback for when a previously-full write buffer empties. */
  onDrain: (callback: () => void) => void
  /** Close the connection after the current response is flushed. */
  end: () => void
}

type RtspRequest = {
  method: string
  uri: string
  headers: Record<string, string>
  body: string
}

/**
 * Owns one client's RTSP conversation: framing the byte stream into requests, the publisher vs
 * subscriber state machine, and coordinating with the relay. Bytes arrive through {@link receive};
 * every response and every fanned-out RTP packet leaves through the transport.
 *
 * @param transport - The connection adapter responses and RTP packets are written to.
 * @param relay - The shared stream relay this session publishes to or subscribes from.
 * @param options - Connection metadata; `remoteLabel` is used only for log lines.
 */
export function createRtspSession(
  transport: RtspTransport,
  relay: StreamRelay,
  options: { remoteLabel: string }
) {
  const remote = options.remoteLabel

  let buffer = ''
  let isPublisher = false
  // After RECORD, the connection stops speaking RTSP and starts streaming interleaved RTP. From
  // that point every received chunk is forwarded verbatim to the relay rather than framed.
  let publisherMode = false
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
    transport.write(response)
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
    // Defensive: if this same connection had previously SETUP'd as a subscriber, clear that record
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
    const transportHeader = headers['transport'] ?? ''
    const match = transportHeader.match(/interleaved=(\d+)-(\d+)/)
    sessionId = generateSessionId()

    let rtpChannel = 0
    if (match) {
      rtpChannel = parseInt(match[1], 10)
      handle = relay.addSubscriber({
        write: (bytes) => transport.write(bytes),
        onDrain: (callback) => transport.onDrain(callback),
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
    // Hand the rest of the connection to the relay. Any bytes already buffered behind the RECORD
    // request are dropped, matching the prior socket-listener-swap behavior; a real publisher waits
    // for this 200 OK before it starts streaming, so nothing is lost in practice.
    publisherMode = true
    buffer = ''
  }

  function routeTeardown(cseq: string) {
    handle?.detach()
    handle = null
    sendResponse(cseq, '200 OK')
    transport.end()
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

  /**
   * Feed the next chunk of bytes from the connection. Before RECORD the bytes are framed into RTSP
   * requests and routed; after RECORD they are forwarded verbatim to the relay as interleaved RTP.
   */
  function receive(raw: Buffer) {
    if (publisherMode) {
      relay.pushPublisherBytes(raw)
      return
    }

    buffer += raw.toString('ascii')

    const { requests, rest } = frameRtspRequests(buffer)
    buffer = rest

    for (const request of requests) {
      if (publisherMode) break
      try {
        onRequest(request.method, request.uri, request.headers, request.body)
      } catch {
        sendResponse(request.headers['cseq'] ?? '0', '500 Internal Error')
      }
    }
  }

  /**
   * Called when the underlying connection drops (close or error). Releases whatever role this
   * session held so the relay does not keep a dead publisher or subscriber.
   */
  function close() {
    if (isPublisher) relay.detachPublisher()
    handle?.detach()
    handle = null
  }

  return {
    receive,
    close,
    get isPublisher() {
      return isPublisher
    },
  }
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
