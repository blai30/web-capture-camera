import net from 'net'

import { rtspConfig } from '../onvif/config'

const CRLF = '\r\n'

type ClientSession = {
  socket: net.Socket
  sessionId: string
  rtpChannel: number
  rtcpChannel: number
  playing: boolean
}

class RtspServer {
  private server: net.Server | null = null
  private publisherSocket: net.Socket | null = null
  private publisherSessionId = ''
  private publisherSdp = ''
  private publisherBuffer = Buffer.alloc(0)
  private subscribers = new Map<string, ClientSession>()
  private rtpRingBuffer: Buffer[] = []
  private readonly maxBuffer = 60

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket)
      })

      this.server.on('error', reject)
      this.server.listen(rtspConfig.port, '0.0.0.0', () => {
        console.log(`[RTSP] Server listening on port ${rtspConfig.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }
      this.server.close(() => resolve())
    })
  }

  private handleConnection(socket: net.Socket) {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`
    console.log(`[RTSP] Connection from ${remote}`)

    socket.setKeepAlive(true, 15000)
    socket.setNoDelay(true)

    let buffer = ''
    let isPublisher = false
    let sessionId = ''
    let currentPath = ''
    let rtpChannel = 0

    const sendResponse = (
      cseq: string,
      status: string,
      extraHeaders: Record<string, string> = {},
      body?: string
    ) => {
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

    const parseHeaders = (text: string): Record<string, string> => {
      const headers: Record<string, string> = {}
      const lines = text.split('\r\n')
      for (const line of lines.slice(1)) {
        const idx = line.indexOf(':')
        if (idx === -1) continue
        const key = line.substring(0, idx).trim().toLowerCase()
        const value = line.substring(idx + 1).trim()
        headers[key] = value
      }
      return headers
    }

    const onPublisherData = (chunk: Buffer) => {
      // Prepend any leftover bytes from the previous chunk
      const data =
        this.publisherBuffer.length > 0 ? Buffer.concat([this.publisherBuffer, chunk]) : chunk
      this.publisherBuffer = Buffer.alloc(0)

      let offset = 0
      while (offset < data.length) {
        if (data[offset] !== INTERLEAVED_PREFIX) {
          offset++
          continue
        }
        // Need 4-byte header
        if (offset + 4 > data.length) break
        const channel = data[offset + 1]
        const length = (data[offset + 2] << 8) | data[offset + 3]
        const end = offset + 4 + length
        // Need full payload
        if (end > data.length) break
        const payload = data.subarray(offset + 4, end)

        if (channel % 2 === 0) {
          this.rtpRingBuffer.push(Buffer.from(payload))
          if (this.rtpRingBuffer.length > this.maxBuffer) {
            this.rtpRingBuffer.shift()
          }
          for (const [id, sub] of this.subscribers.entries()) {
            if (sub.playing) {
              const ok = sub.socket.write(
                Buffer.concat([interleavedHeader(sub.rtpChannel, payload.length), payload])
              )
              if (!ok) {
                // Drain-aware: pause until the socket drains to avoid unbounded buffering
                sub.socket.once('drain', () => {})
              }
            }
          }
        }
        offset = end
      }

      // Save any incomplete trailing bytes for the next chunk
      if (offset < data.length) {
        this.publisherBuffer = Buffer.from(data.subarray(offset))
      }
    }

    const routeOptions = (cseq: string) => {
      sendResponse(cseq, '200 OK', {
        Public: 'DESCRIBE, ANNOUNCE, SETUP, PLAY, TEARDOWN, OPTIONS, GET_PARAMETER, SET_PARAMETER',
      })
    }

    const routeAnnounce = (
      cseq: string,
      uri: string,
      _headers: Record<string, string>,
      body: string
    ) => {
      isPublisher = true
      currentPath = uri
      this.publisherSocket = socket
      this.publisherSdp = body

      for (const [id, sess] of this.subscribers.entries()) {
        if (sess.socket === socket) {
          this.subscribers.delete(id)
          this.publisherSessionId = id
          break
        }
      }

      console.log(`[RTSP] ANNOUNCE from ${remote} on ${uri}`)
      sendResponse(cseq, '200 OK')
    }

    const routeDescribe = (cseq: string) => {
      if (this.publisherSdp) {
        console.log(`[RTSP] Returning SDP (${this.publisherSdp.length} chars)`)
        sendResponse(cseq, '200 OK', { 'Cache-Control': 'no-cache' }, this.publisherSdp)
      } else {
        console.log('[RTSP] DESCRIBE rejected: no publisher SDP yet')
        sendResponse(cseq, '404 Not Found')
      }
    }

    const routeSetup = (cseq: string, uri: string, headers: Record<string, string>) => {
      const transport = headers['transport'] ?? ''
      const match = transport.match(/interleaved=(\d+)-(\d+)/)
      sessionId = generateSessionId()

      if (match) {
        rtpChannel = parseInt(match[1], 10)
        currentPath = uri
        this.subscribers.set(sessionId, {
          socket,
          sessionId,
          rtpChannel: parseInt(match[1], 10),
          rtcpChannel: parseInt(match[2], 10),
          playing: false,
        })
      }

      sendResponse(cseq, '200 OK', {
        Transport: 'RTP/AVP/TCP;unicast;interleaved=' + rtpChannel + '-' + (rtpChannel + 1),
        Session: sessionId,
      })
    }

    const routePlay = (cseq: string, uri: string) => {
      const sess = this.subscribers.get(sessionId)
      if (sess) {
        sess.playing = true
        for (const frame of this.rtpRingBuffer) {
          try {
            socket.write(Buffer.concat([interleavedHeader(rtpChannel, frame.length), frame]))
          } catch {
            /* silent */
          }
        }
      }
      sendResponse(cseq, '200 OK', {
        Session: sessionId,
        'RTP-Info': `url=${uri};seq=0;rtptime=0`,
      })
    }

    const routeRecord = (cseq: string, uri: string) => {
      console.log(`[RTSP] RECORD ${uri}`)
      sendResponse(cseq, '200 OK', { Session: sessionId })
      socket.removeListener('data', onData)
      socket.on('data', onPublisherData)
    }

    const routeTeardown = (cseq: string, _uri: string, headers: Record<string, string>) => {
      const sess = headers['session']?.split(';')[0] ?? ''
      this.subscribers.delete(sess)
      sendResponse(cseq, '200 OK')
      socket.end()
    }

    const routeGetParameter = (cseq: string) => {
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

    const onRequest = (
      method: string,
      uri: string,
      headers: Record<string, string>,
      body: string
    ) => {
      const cseq = headers['cseq'] ?? '0'
      console.log(`[RTSP] ${method} ${uri} (CSeq: ${cseq}) from ${remote}`)

      const handler = routes[method]
      if (handler) {
        handler(cseq, uri, headers, body)
      } else {
        sendResponse(cseq, '501 Not Implemented')
      }
    }

    const onData = (raw: Buffer) => {
      const text = raw.toString('ascii')
      buffer += text

      while (true) {
        const headerEnd = buffer.indexOf(CRLF + CRLF)
        if (headerEnd === -1) break

        const headerText = buffer.substring(0, headerEnd)
        const lines = headerText.split('\r\n')
        const parts = lines[0].split(' ')
        if (parts.length < 3) {
          buffer = ''
          return
        }
        const method = parts[0]
        const uri = parts[1]

        const headers = parseHeaders(headerText)
        const bodyLength = parseInt(headers['content-length'] ?? '0', 10)

        const afterHeaders = headerEnd + 4
        if (buffer.substring(afterHeaders).length < bodyLength) break

        const body = buffer.substring(afterHeaders, afterHeaders + bodyLength)
        buffer = buffer.substring(afterHeaders + bodyLength)

        try {
          onRequest(method, uri, headers, body)
        } catch {
          const cseq = headers['cseq'] ?? '0'
          sendResponse(cseq, '500 Internal Error')
        }
      }
    }

    socket.on('data', onData)

    socket.on('error', () => {
      this.cleanupPublisher(socket)
      this.cleanupSubscriber(sessionId)
    })

    socket.on('close', () => {
      console.log(`[RTSP] Connection closed: ${remote}${isPublisher ? ' (publisher)' : ''}`)
      this.cleanupPublisher(socket)
      this.cleanupSubscriber(sessionId)
    })
  }

  private cleanupPublisher(socket: net.Socket) {
    if (this.publisherSocket === socket) {
      this.publisherSocket = null
      this.publisherBuffer = Buffer.alloc(0)
    }
  }

  private cleanupSubscriber(id: string) {
    if (id) {
      this.subscribers.delete(id)
    }
  }
}

const INTERLEAVED_PREFIX = 0x24

function interleavedHeader(channel: number, length: number): Buffer {
  const buf = Buffer.alloc(4)
  buf[0] = INTERLEAVED_PREFIX
  buf[1] = channel
  buf.writeUInt16BE(length, 2)
  return buf
}

function generateSessionId(): string {
  return Math.random().toString(16).slice(2, 10)
}

let server: RtspServer | null = null

export function createRtspServer(): RtspServer {
  server = new RtspServer()
  return server
}

export function getRtspServer(): RtspServer | null {
  return server
}
