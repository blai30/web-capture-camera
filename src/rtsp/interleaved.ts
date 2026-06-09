// RTSP interleaved binary framing (RFC 2326 section 10.12): RTP/RTCP packets multiplexed onto the
// RTSP TCP connection, each prefixed with `$`, a one-byte channel, and a 16-bit big-endian length.
const INTERLEAVED_PREFIX = 0x24

/** One de-framed interleaved packet. `payload` aliases the input buffer; copy it to retain it. */
export type InterleavedFrame = {
  channel: number
  payload: Buffer
}

/**
 * Pulls every complete interleaved frame out of a byte stream, returning them with the unconsumed
 * remainder. A partial trailing frame (incomplete header or payload) is left in `rest` for the next
 * chunk; bytes that are not part of a frame are skipped. The returned payloads and `rest` are views
 * into `data`, so a caller that keeps them past the next mutation of `data` must copy them.
 */
export function parseInterleavedFrames(data: Buffer): {
  frames: InterleavedFrame[]
  rest: Buffer
} {
  const frames: InterleavedFrame[] = []
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

    frames.push({ channel, payload: data.subarray(offset + 4, end) })
    offset = end
  }

  return { frames, rest: data.subarray(offset) }
}

/** Builds the 4-byte interleaved header (`$`, channel, 16-bit length) that prefixes a packet. */
export function interleavedHeader(channel: number, length: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer[0] = INTERLEAVED_PREFIX
  buffer[1] = channel
  buffer.writeUInt16BE(length, 2)
  return buffer
}
