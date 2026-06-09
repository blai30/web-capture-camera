import { classifyH264NalUnit } from './h264.ts'

const INTERLEAVED_PREFIX = 0x24
const DEFAULT_MAX_GOP_PACKETS = 512

/** Thrown by the relay's `attachPublisher` when a publisher is already attached. */
export class PublisherBusyError extends Error {
  constructor() {
    super('A publisher is already attached')
    this.name = 'PublisherBusyError'
  }
}

export type NalClassification = {
  isIdr: boolean
  isParameterSet: boolean
}

/** Receives the H.264 RTP payload (the bytes after the generic RTP header), not the raw packet. */
export type PayloadClassifier = (rtpPayload: Buffer) => NalClassification

type SubscriberAdapter = {
  write: (bytes: Buffer) => boolean
  onDrain: (callback: () => void) => void
  rtpChannel: number
}

/** Controls one subscriber's delivery. Returned by the relay's `addSubscriber`. */
export type SubscriberHandle = {
  /**
   * Start delivering RTP to this subscriber. If a keyframe is already buffered, the cached
   * parameter sets and current GOP are replayed first so the subscriber can decode immediately.
   */
  play: () => void
  /** Stop delivery and remove this subscriber from the relay. */
  detach: () => void
}

type SubscriberRecord = {
  adapter: SubscriberAdapter
  playing: boolean
  backpressured: boolean
}

/**
 * The fan-out hub between a single RTSP publisher and many subscribers. The publisher's interleaved
 * RTP is parsed into packets, retained for keyframe catchup, and forwarded to every playing
 * subscriber.
 *
 * Typical lifecycle: `attachPublisher(sdp)` once, then `pushPublisherBytes(chunk)` repeatedly;
 * subscribers call `addSubscriber(...)` then `play()`, and may join at any time.
 *
 * @param options.maxGopPackets - Cap on packets retained per GOP, a runaway guard. Defaults to 512.
 * @param options.classifyPayload - How an RTP payload is classified as IDR / parameter set.
 *   Defaults to the H.264 classifier; injectable for other codecs or for tests.
 */
export function createStreamRelay(options?: {
  maxGopPackets?: number
  classifyPayload?: PayloadClassifier
}) {
  const maxGopPackets = options?.maxGopPackets ?? DEFAULT_MAX_GOP_PACKETS
  const classifyPayload = options?.classifyPayload ?? classifyH264NalUnit

  let publisherAttached = false
  // Retained across detachPublisher so a DESCRIBE that races a publisher restart
  // still returns the last known SDP.
  let publisherSdp: string | null = null
  let publisherBuffer = Buffer.alloc(0)
  const subscribers = new Map<symbol, SubscriberRecord>()

  // Catchup state. `currentGop` holds every RTP packet from the most recent IDR forward, so a
  // late-joining subscriber can always be handed a complete keyframe. `parameterSets` caches the
  // most recent SPS/PPS preamble separately, since encoders may send it once at stream start
  // rather than before every IDR, we prepend it on replay so the IDR is decodable.
  let currentGop: Buffer[] = []
  let parameterSets: Buffer[] = []
  let collectingParameterSets = false

  /**
   * Register the sole publisher and its SDP, resetting any retained keyframe state.
   * @throws {PublisherBusyError} if a publisher is already attached.
   */
  function attachPublisher(sdp: string) {
    if (publisherAttached) throw new PublisherBusyError()
    publisherAttached = true
    publisherSdp = sdp
    publisherBuffer = Buffer.alloc(0)
    // A fresh publisher is a fresh stream; old keyframe/parameter-set state is stale.
    currentGop = []
    parameterSets = []
    collectingParameterSets = false
  }

  /** Release the publisher so a new one can attach. The last SDP is kept for a racing DESCRIBE. */
  function detachPublisher() {
    publisherAttached = false
    publisherBuffer = Buffer.alloc(0)
  }

  /** The most recently announced publisher SDP, or null if none has ever attached. */
  function getSdp(): string | null {
    return publisherSdp
  }

  function writeToSubscriber(record: SubscriberRecord, packet: Buffer): boolean {
    const frame = Buffer.concat([
      interleavedHeader(record.adapter.rtpChannel, packet.length),
      packet,
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

  function fanoutPacket(packet: Buffer) {
    for (const record of subscribers.values()) {
      if (!record.playing || record.backpressured) continue
      writeToSubscriber(record, packet)
    }
  }

  function retainForCatchup(packet: Buffer) {
    const rtpPayload = stripRtpHeader(packet)
    const classification = rtpPayload
      ? classifyPayload(rtpPayload)
      : { isIdr: false, isParameterSet: false }

    if (classification.isIdr) {
      // New keyframe, start a fresh GOP. Any previous GOP is dead weight for catchup.
      collectingParameterSets = false
      currentGop = [packet]
      return
    }

    if (classification.isParameterSet) {
      // Accumulate a run of consecutive parameter-set packets, replacing the prior cache.
      if (!collectingParameterSets) {
        parameterSets = []
        collectingParameterSets = true
      }
      parameterSets.push(packet)
      return
    }

    collectingParameterSets = false
    // Only grow the GOP once a keyframe has anchored it; cap as a runaway guard.
    if (currentGop.length > 0 && currentGop.length < maxGopPackets) {
      currentGop.push(packet)
    }
  }

  /**
   * Feed raw RTSP-interleaved bytes from the publisher. Complete RTP packets on even (data)
   * channels are retained for catchup and fanned out; a partial trailing frame is buffered until
   * the next call.
   */
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
        const packet = Buffer.from(payload)
        retainForCatchup(packet)
        fanoutPacket(packet)
      }
      offset = end
    }

    if (offset < data.length) {
      publisherBuffer = Buffer.from(data.subarray(offset))
    }
  }

  /**
   * Register a subscriber sink. Delivery does not start until the returned handle's `play()` is
   * called.
   */
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
      // No keyframe buffered yet, skip replay and let live fan-out deliver the next IDR.
      if (currentGop.length === 0) return
      // Prepend the cached parameter sets so the keyframe is decodable, then replay the GOP.
      for (const packet of parameterSets) {
        writeToSubscriber(record, packet)
      }
      for (const packet of currentGop) {
        writeToSubscriber(record, packet)
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

// Strips the generic RTP header (RFC 3550) and returns the payload that follows, or null if the
// packet is too short to be a valid RTP packet. Transport-level concern, codec-agnostic.
function stripRtpHeader(packet: Buffer): Buffer | null {
  if (packet.length < 12) return null
  const csrcCount = packet[0] & 0x0f
  const hasExtension = (packet[0] & 0x10) !== 0
  let headerLength = 12 + csrcCount * 4
  if (hasExtension) {
    if (packet.length < headerLength + 4) return null
    const extensionWords = packet.readUInt16BE(headerLength + 2)
    headerLength += 4 + extensionWords * 4
  }
  if (packet.length <= headerLength) return null
  return packet.subarray(headerLength)
}

function interleavedHeader(channel: number, length: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer[0] = INTERLEAVED_PREFIX
  buffer[1] = channel
  buffer.writeUInt16BE(length, 2)
  return buffer
}
