import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyH264NalUnit } from './h264.ts'

test('classifies a single IDR slice NAL', () => {
  assert.deepEqual(classifyH264NalUnit(Buffer.from([0x65])), {
    isIdr: true,
    isParameterSet: false,
  })
})

test('classifies SPS and PPS as parameter sets', () => {
  assert.deepEqual(classifyH264NalUnit(Buffer.from([0x67])), {
    isIdr: false,
    isParameterSet: true,
  })
  assert.deepEqual(classifyH264NalUnit(Buffer.from([0x68])), {
    isIdr: false,
    isParameterSet: true,
  })
})

test('classifies a non-IDR slice as neither', () => {
  assert.deepEqual(classifyH264NalUnit(Buffer.from([0x61])), {
    isIdr: false,
    isParameterSet: false,
  })
})

test('reads the original type from an FU-A fragment header', () => {
  // FU indicator (type 28) then an FU header whose low 5 bits carry the real type (5 = IDR).
  assert.deepEqual(classifyH264NalUnit(Buffer.from([0x7c, 0x85])), {
    isIdr: true,
    isParameterSet: false,
  })
})

test('detects units aggregated inside a STAP-A packet', () => {
  // STAP-A header (type 24), then [size=1][SPS 0x67] and [size=1][IDR 0x65].
  const stapA = Buffer.from([0x78, 0x00, 0x01, 0x67, 0x00, 0x01, 0x65])
  assert.deepEqual(classifyH264NalUnit(stapA), {
    isIdr: true,
    isParameterSet: true,
  })
})

test('returns neither for an empty payload', () => {
  assert.deepEqual(classifyH264NalUnit(Buffer.alloc(0)), {
    isIdr: false,
    isParameterSet: false,
  })
})
