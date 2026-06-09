import assert from 'node:assert/strict'
import { test } from 'node:test'

import { interleavedHeader, parseInterleavedFrames } from './interleaved.ts'

function frame(channel: number, payload: number[]): Buffer {
  return Buffer.concat([interleavedHeader(channel, payload.length), Buffer.from(payload)])
}

test('parses a single complete interleaved frame', () => {
  const { frames, rest } = parseInterleavedFrames(frame(0, [0xaa, 0xbb, 0xcc]))
  assert.equal(frames.length, 1)
  assert.equal(frames[0].channel, 0)
  assert.deepEqual(frames[0].payload, Buffer.from([0xaa, 0xbb, 0xcc]))
  assert.equal(rest.length, 0)
})

test('parses multiple back-to-back frames and preserves each channel', () => {
  const input = Buffer.concat([frame(0, [0x01]), frame(1, [0x02, 0x03]), frame(0, [0x04])])
  const { frames, rest } = parseInterleavedFrames(input)
  assert.deepEqual(
    frames.map((entry) => entry.channel),
    [0, 1, 0]
  )
  assert.deepEqual(
    frames.map((entry) => [...entry.payload]),
    [[0x01], [0x02, 0x03], [0x04]]
  )
  assert.equal(rest.length, 0)
})

test('leaves an incomplete payload in rest for the next chunk', () => {
  const complete = frame(0, [0x01])
  // Declares a 4-byte payload but only two bytes are present.
  const partial = Buffer.from([0x24, 0x00, 0x00, 0x04, 0xde, 0xad])
  const { frames, rest } = parseInterleavedFrames(Buffer.concat([complete, partial]))
  assert.equal(frames.length, 1)
  assert.deepEqual(rest, partial)
})

test('leaves an incomplete header in rest', () => {
  // Prefix and channel only; the two length bytes have not arrived yet.
  const input = Buffer.from([0x24, 0x00])
  const { frames, rest } = parseInterleavedFrames(input)
  assert.equal(frames.length, 0)
  assert.deepEqual(rest, input)
})

test('skips bytes that precede the interleaved prefix', () => {
  const input = Buffer.concat([Buffer.from([0x99, 0x88]), frame(0, [0x01])])
  const { frames, rest } = parseInterleavedFrames(input)
  assert.equal(frames.length, 1)
  assert.deepEqual(frames[0].payload, Buffer.from([0x01]))
  assert.equal(rest.length, 0)
})

test('handles a zero-length payload frame', () => {
  const { frames, rest } = parseInterleavedFrames(frame(0, []))
  assert.equal(frames.length, 1)
  assert.equal(frames[0].payload.length, 0)
  assert.equal(rest.length, 0)
})

test('reassembles a frame split across two chunks via rest', () => {
  const whole = frame(2, [0x10, 0x20, 0x30])
  const firstChunk = whole.subarray(0, 5) // header + one payload byte
  const secondChunk = whole.subarray(5) // the remaining two payload bytes

  const passOne = parseInterleavedFrames(firstChunk)
  assert.equal(passOne.frames.length, 0)

  const passTwo = parseInterleavedFrames(Buffer.concat([passOne.rest, secondChunk]))
  assert.equal(passTwo.frames.length, 1)
  assert.equal(passTwo.frames[0].channel, 2)
  assert.deepEqual(passTwo.frames[0].payload, Buffer.from([0x10, 0x20, 0x30]))
})
