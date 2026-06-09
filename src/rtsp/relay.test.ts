import assert from 'node:assert/strict'
import { test } from 'node:test'

import { interleavedHeader } from './interleaved.ts'
import { createStreamRelay, PublisherBusyError } from './relay.ts'

const NAL_NON_IDR = 1
const NAL_IDR = 5
const NAL_SPS = 7
const NAL_PPS = 8

// A minimal RTP packet: a 12-byte header (version 2, no CSRC/extension) followed by a one-byte NAL
// header carrying `nalType` in its low 5 bits, plus a marker byte so packets stay distinguishable.
function rtpPacket(nalType: number, marker: number): Buffer {
  return Buffer.from([
    0x80,
    0x60,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x60 | nalType,
    marker,
  ])
}

function recordingSubscriber(rtpChannel = 0) {
  const writes: Buffer[] = []
  const adapter = {
    write: (bytes: Buffer) => {
      writes.push(Buffer.from(bytes))
      return true
    },
    onDrain: () => {},
    rtpChannel,
  }
  // The packets actually delivered, with the 4-byte interleaved header peeled back off.
  const delivered = () => writes.map((written) => written.subarray(4))
  return { adapter, writes, delivered }
}

test('a late subscriber is caught up with parameter sets then the current GOP', () => {
  const relay = createStreamRelay()
  const sps = rtpPacket(NAL_SPS, 1)
  const pps = rtpPacket(NAL_PPS, 2)
  const idr = rtpPacket(NAL_IDR, 3)
  const delta = rtpPacket(NAL_NON_IDR, 4)

  relay.ingestPacket(sps)
  relay.ingestPacket(pps)
  relay.ingestPacket(idr)
  relay.ingestPacket(delta)

  const subscriber = recordingSubscriber()
  relay.addSubscriber(subscriber.adapter).play()

  assert.deepEqual(subscriber.delivered(), [sps, pps, idr, delta])
})

test('a subscriber that joins before any keyframe receives nothing until live packets arrive', () => {
  const relay = createStreamRelay()
  const subscriber = recordingSubscriber()
  relay.addSubscriber(subscriber.adapter).play()
  assert.equal(subscriber.delivered().length, 0)

  const live = rtpPacket(NAL_NON_IDR, 1)
  relay.ingestPacket(live)
  assert.deepEqual(subscriber.delivered(), [live])
})

test('a new IDR starts a fresh GOP, dropping the previous keyframe', () => {
  const relay = createStreamRelay()
  relay.ingestPacket(rtpPacket(NAL_IDR, 1))
  relay.ingestPacket(rtpPacket(NAL_NON_IDR, 2))
  const idr2 = rtpPacket(NAL_IDR, 3)
  relay.ingestPacket(idr2)

  const subscriber = recordingSubscriber()
  relay.addSubscriber(subscriber.adapter).play()
  assert.deepEqual(subscriber.delivered(), [idr2])
})

test('the retained GOP is capped by maxGopPackets', () => {
  const relay = createStreamRelay({ maxGopPackets: 3 })
  relay.ingestPacket(rtpPacket(NAL_IDR, 0))
  for (let index = 1; index <= 10; index++) {
    relay.ingestPacket(rtpPacket(NAL_NON_IDR, index))
  }

  const subscriber = recordingSubscriber()
  relay.addSubscriber(subscriber.adapter).play()
  // The IDR plus two deltas: growth stops once the GOP reaches the cap.
  assert.equal(subscriber.delivered().length, 3)
})

test('live packets fan out only to playing subscribers', () => {
  const relay = createStreamRelay()
  const playing = recordingSubscriber()
  const idle = recordingSubscriber()
  relay.addSubscriber(playing.adapter).play()
  relay.addSubscriber(idle.adapter) // never calls play()

  const live = rtpPacket(NAL_NON_IDR, 1)
  relay.ingestPacket(live)

  assert.deepEqual(playing.delivered(), [live])
  assert.equal(idle.delivered().length, 0)
})

test('fanned-out packets carry the subscriber interleaved channel header', () => {
  const relay = createStreamRelay()
  const subscriber = recordingSubscriber(4)
  relay.addSubscriber(subscriber.adapter).play()

  const live = rtpPacket(NAL_NON_IDR, 1)
  relay.ingestPacket(live)

  assert.deepEqual(subscriber.writes[0], Buffer.concat([interleavedHeader(4, live.length), live]))
})

test('attachPublisher rejects a second publisher', () => {
  const relay = createStreamRelay()
  relay.attachPublisher('sdp-1')
  assert.throws(() => relay.attachPublisher('sdp-2'), PublisherBusyError)
})

test('attaching a fresh publisher clears the retained keyframe', () => {
  const relay = createStreamRelay()
  relay.ingestPacket(rtpPacket(NAL_IDR, 1))
  relay.attachPublisher('sdp')

  const subscriber = recordingSubscriber()
  relay.addSubscriber(subscriber.adapter).play()
  assert.equal(subscriber.delivered().length, 0)
})

test('pushPublisherBytes de-frames interleaved bytes into ingested packets', () => {
  const relay = createStreamRelay()
  const subscriber = recordingSubscriber(0)
  relay.addSubscriber(subscriber.adapter).play()

  const idr = rtpPacket(NAL_IDR, 1)
  relay.pushPublisherBytes(Buffer.concat([interleavedHeader(0, idr.length), idr]))

  assert.deepEqual(subscriber.delivered(), [idr])
})

test('pushPublisherBytes ignores odd (RTCP) channels', () => {
  const relay = createStreamRelay()
  const subscriber = recordingSubscriber(0)
  relay.addSubscriber(subscriber.adapter).play()

  const rtcp = rtpPacket(NAL_NON_IDR, 1)
  relay.pushPublisherBytes(Buffer.concat([interleavedHeader(1, rtcp.length), rtcp]))

  assert.equal(subscriber.delivered().length, 0)
})
