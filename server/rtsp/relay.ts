const INTERLEAVED_PREFIX = 0x24
const DEFAULT_RING_BUFFER_SIZE = 60

export class PublisherBusyError extends Error {
  constructor() {
    super('A publisher is already attached')
    this.name = 'PublisherBusyError'
  }
}

export type SubscriberAdapter = {
  write: (bytes: Buffer) => boolean
  onDrain: (callback: () => void) => void
  rtpChannel: number
}

export type SubscriberHandle = {
  play: () => void
  detach: () => void
}

type SubscriberRecord = {
  adapter: SubscriberAdapter
  playing: boolean
  backpressured: boolean
}

export function createStreamRelay(options?: { ringBufferSize?: number }) {
  const ringBufferSize = options?.ringBufferSize ?? DEFAULT_RING_BUFFER_SIZE

  let publisherAttached = false
  // Retained across detachPublisher so a DESCRIBE that races a publisher restart
  // still returns the last known SDP.
  let publisherSdp: string | null = null
  let publisherBuffer = Buffer.alloc(0)
  const subscribers = new Map<symbol, SubscriberRecord>()
  const rtpRingBuffer: Buffer[] = []

  function attachPublisher(sdp: string) {
    if (publisherAttached) throw new PublisherBusyError()
    publisherAttached = true
    publisherSdp = sdp
    publisherBuffer = Buffer.alloc(0)
  }

  function detachPublisher() {
    publisherAttached = false
    publisherBuffer = Buffer.alloc(0)
  }

  function getSdp(): string | null {
    return publisherSdp
  }

  function writeToSubscriber(record: SubscriberRecord, payload: Buffer): boolean {
    const frame = Buffer.concat([
      interleavedHeader(record.adapter.rtpChannel, payload.length),
      payload,
    ])
    const success = record.adapter.write(frame)
    if (!success && !record.backpressured) {
      record.backpressured = true
      record.adapter.onDrain(() => {
        record.backpressured = false
      })
    }
    return success
  }

  function fanoutPayload(payload: Buffer) {
    for (const record of subscribers.values()) {
      if (!record.playing || record.backpressured) continue
      writeToSubscriber(record, payload)
    }
  }

  function pushPublisherBytes(chunk: Buffer) {
    const data = publisherBuffer.length > 0 ? Buffer.concat([publisherBuffer, chunk]) : chunk
    publisherBuffer = Buffer.alloc(0)

    let offset = 0
    while (offset < data.length) {
      if (data[offset] !== INTERLEAVED_PREFIX) {
        offset++
        continue
      }
      if (offset + 4 > data.length) break
      const channel = data[offset + 1]
      const length = (data[offset + 2] << 8) | data[offset + 3]
      const end = offset + 4 + length
      if (end > data.length) break
      const payload = data.subarray(offset + 4, end)

      if (channel % 2 === 0) {
        const stored = Buffer.from(payload)
        rtpRingBuffer.push(stored)
        if (rtpRingBuffer.length > ringBufferSize) rtpRingBuffer.shift()
        fanoutPayload(stored)
      }
      offset = end
    }

    if (offset < data.length) {
      publisherBuffer = Buffer.from(data.subarray(offset))
    }
  }

  function addSubscriber(adapter: SubscriberAdapter): SubscriberHandle {
    const id = Symbol()
    const record: SubscriberRecord = {
      adapter,
      playing: false,
      backpressured: false,
    }
    subscribers.set(id, record)

    function play() {
      record.playing = true
      // Best-effort replay: feed all ring frames; if the socket flags backpressure mid-burst
      // we still finish (TCP queues), then live fan-out skips this sub until 'drain' fires.
      for (const payload of rtpRingBuffer) {
        writeToSubscriber(record, payload)
      }
    }

    function detach() {
      subscribers.delete(id)
    }

    return { play, detach }
  }

  return {
    attachPublisher,
    detachPublisher,
    pushPublisherBytes,
    getSdp,
    addSubscriber,
  }
}

function interleavedHeader(channel: number, length: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer[0] = INTERLEAVED_PREFIX
  buffer[1] = channel
  buffer.writeUInt16BE(length, 2)
  return buffer
}
