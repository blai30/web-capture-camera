import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { RtspTransport } from './session.ts'

// Silence the shared pino logger before the modules under test initialize it, so test output stays
// clean. The static imports above are type-only or node builtins (neither initializes the logger);
// session/relay load dynamically below, after the level is set.
process.env.LOG_LEVEL = 'silent'
const { createRtspSession } = await import('./session.ts')
const { createStreamRelay } = await import('./relay.ts')

const INTERLEAVED_PREFIX = 0x24

// A transport that records every write and whether end() was called, standing in for net.Socket.
// Its existence is the whole point of the seam: the RTSP state machine is driven with no real socket.
function createRecordingTransport() {
  const writes: Buffer[] = []
  let ended = false

  const transport: RtspTransport = {
    write(bytes) {
      writes.push(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'ascii'))
      return true
    },
    onDrain() {},
    end() {
      ended = true
    },
  }

  return {
    transport,
    writes,
    text: () => Buffer.concat(writes).toString('ascii'),
    isEnded: () => ended,
  }
}

function rtspRequest(
  method: string,
  uri: string,
  headers: Record<string, string> = {},
  body = ''
): Buffer {
  const allHeaders: Record<string, string> = { ...headers }
  if (body) allHeaders['Content-Length'] = String(Buffer.byteLength(body))
  const lines = [`${method} ${uri} RTSP/1.0`]
  for (const [key, value] of Object.entries(allHeaders)) lines.push(`${key}: ${value}`)
  return Buffer.from(lines.join('\r\n') + '\r\n\r\n' + body, 'ascii')
}

test('OPTIONS advertises the supported methods', () => {
  const recorder = createRecordingTransport()
  const session = createRtspSession(recorder.transport, createStreamRelay(), {
    remoteLabel: 'test',
  })

  session.receive(rtspRequest('OPTIONS', '*', { CSeq: '1' }))

  const response = recorder.text()
  assert.match(response, /^RTSP\/1\.0 200 OK/)
  assert.match(response, /CSeq: 1/)
  assert.match(response, /Public:.*ANNOUNCE.*SETUP.*PLAY/)
})

test('DESCRIBE is 404 with no publisher and returns the SDP once one is attached', () => {
  const relay = createStreamRelay()

  const earlyViewer = createRecordingTransport()
  createRtspSession(earlyViewer.transport, relay, { remoteLabel: 'viewer' }).receive(
    rtspRequest('DESCRIBE', 'rtsp://x/stream', { CSeq: '1' })
  )
  assert.match(earlyViewer.text(), /404 Not Found/)

  const publisher = createRecordingTransport()
  createRtspSession(publisher.transport, relay, { remoteLabel: 'pub' }).receive(
    rtspRequest('ANNOUNCE', 'rtsp://x/stream', { CSeq: '1' }, 'v=0\r\nm=video 0 RTP/AVP 96')
  )

  const lateViewer = createRecordingTransport()
  createRtspSession(lateViewer.transport, relay, { remoteLabel: 'viewer2' }).receive(
    rtspRequest('DESCRIBE', 'rtsp://x/stream', { CSeq: '2' })
  )
  const response = lateViewer.text()
  assert.match(response, /200 OK/)
  assert.match(response, /Content-Type: application\/sdp/)
  assert.match(response, /m=video 0 RTP\/AVP 96/)
})

test('a second publisher is rejected with 503 while the first holds the stream', () => {
  const relay = createStreamRelay()

  const first = createRecordingTransport()
  createRtspSession(first.transport, relay, { remoteLabel: 'pub1' }).receive(
    rtspRequest('ANNOUNCE', 'rtsp://x/stream', { CSeq: '1' }, 'v=0')
  )
  assert.match(first.text(), /200 OK/)

  const second = createRecordingTransport()
  createRtspSession(second.transport, relay, { remoteLabel: 'pub2' }).receive(
    rtspRequest('ANNOUNCE', 'rtsp://x/stream', { CSeq: '1' }, 'v=0')
  )
  assert.match(second.text(), /503 Service Unavailable/)
})

test('SETUP echoes the interleaved transport and PLAY acknowledges with RTP-Info', () => {
  const recorder = createRecordingTransport()
  const session = createRtspSession(recorder.transport, createStreamRelay(), {
    remoteLabel: 'sub',
  })

  session.receive(
    rtspRequest('SETUP', 'rtsp://x/stream', {
      CSeq: '1',
      Transport: 'RTP/AVP/TCP;unicast;interleaved=0-1',
    })
  )
  const setupResponse = recorder.text()
  assert.match(setupResponse, /200 OK/)
  assert.match(setupResponse, /Transport: RTP\/AVP\/TCP;unicast;interleaved=0-1/)
  assert.match(setupResponse, /Session: /)

  session.receive(rtspRequest('PLAY', 'rtsp://x/stream', { CSeq: '2' }))
  assert.match(recorder.text(), /RTP-Info: url=rtsp:\/\/x\/stream/)
})

test('a publisher RTP packet fans out to a playing subscriber through the seam', () => {
  const relay = createStreamRelay()

  // Subscriber joins and starts playing.
  const subscriber = createRecordingTransport()
  const subscriberSession = createRtspSession(subscriber.transport, relay, {
    remoteLabel: 'sub',
  })
  subscriberSession.receive(
    rtspRequest('SETUP', 'rtsp://x/stream', {
      CSeq: '1',
      Transport: 'RTP/AVP/TCP;unicast;interleaved=0-1',
    })
  )
  subscriberSession.receive(rtspRequest('PLAY', 'rtsp://x/stream', { CSeq: '2' }))

  // Publisher announces and switches into record (interleaved) mode.
  const publisher = createRecordingTransport()
  const publisherSession = createRtspSession(publisher.transport, relay, {
    remoteLabel: 'pub',
  })
  publisherSession.receive(rtspRequest('ANNOUNCE', 'rtsp://x/stream', { CSeq: '1' }, 'v=0'))
  publisherSession.receive(rtspRequest('RECORD', 'rtsp://x/stream', { CSeq: '2' }))

  // A minimal RTP packet: 12-byte header (version 2, no CSRC/extension) + a non-IDR NAL payload.
  const rtpPacket = Buffer.from([
    0x80, 0x60, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0xaa,
  ])
  const interleavedFrame = Buffer.concat([
    Buffer.from([INTERLEAVED_PREFIX, 0x00, 0x00, rtpPacket.length]),
    rtpPacket,
  ])

  // Post-RECORD bytes are no longer framed as RTSP; they flow straight to the relay.
  publisherSession.receive(interleavedFrame)

  const fannedOut = subscriber.writes.find((write) => write[0] === INTERLEAVED_PREFIX)
  assert.ok(fannedOut, 'subscriber should have received an interleaved RTP frame')
  assert.deepEqual(fannedOut, interleavedFrame)
})

test('TEARDOWN acknowledges and ends the transport', () => {
  const recorder = createRecordingTransport()
  const session = createRtspSession(recorder.transport, createStreamRelay(), {
    remoteLabel: 'sub',
  })

  session.receive(rtspRequest('TEARDOWN', 'rtsp://x/stream', { CSeq: '1' }))

  assert.match(recorder.text(), /200 OK/)
  assert.equal(recorder.isEnded(), true)
})

test('an unknown method is answered with 501 Not Implemented', () => {
  const recorder = createRecordingTransport()
  const session = createRtspSession(recorder.transport, createStreamRelay(), {
    remoteLabel: 'sub',
  })

  session.receive(rtspRequest('FROBNICATE', 'rtsp://x/stream', { CSeq: '7' }))

  assert.match(recorder.text(), /501 Not Implemented/)
})
