import type { NalClassification } from './relay.ts'

// H.264 NAL unit types (RFC 6184 §1.3).
const NAL_TYPE_IDR_SLICE = 5
const NAL_TYPE_SPS = 7
const NAL_TYPE_PPS = 8
const NAL_TYPE_STAP_A = 24
const NAL_TYPE_FU_A = 28

const NAL_TYPE_MASK = 0x1f

const EMPTY: NalClassification = { isIdr: false, isParameterSet: false }

/**
 * Classifies an H.264 RTP payload (RFC 6184) by inspecting only its NAL headers, no reassembly.
 * The payload is the RTP packet body with the generic RTP header already stripped.
 */
export function classifyH264NalUnit(rtpPayload: Buffer): NalClassification {
  if (rtpPayload.length < 1) return EMPTY
  const nalUnitType = rtpPayload[0] & NAL_TYPE_MASK

  if (nalUnitType === NAL_TYPE_STAP_A) return classifyStapA(rtpPayload)
  if (nalUnitType === NAL_TYPE_FU_A) return classifyFuA(rtpPayload)
  return classifySingleNalUnit(nalUnitType)
}

function classifySingleNalUnit(nalUnitType: number): NalClassification {
  return {
    isIdr: nalUnitType === NAL_TYPE_IDR_SLICE,
    isParameterSet: nalUnitType === NAL_TYPE_SPS || nalUnitType === NAL_TYPE_PPS,
  }
}

// FU-A (fragmentation unit): the real NAL type lives in the low 5 bits of the FU header,
// the second byte of the payload. Any fragment of the unit reports the same type.
function classifyFuA(rtpPayload: Buffer): NalClassification {
  if (rtpPayload.length < 2) return EMPTY
  const originalNalType = rtpPayload[1] & NAL_TYPE_MASK
  return classifySingleNalUnit(originalNalType)
}

// STAP-A (single-time aggregation): one byte STAP-A header, then a series of
// [2-byte size][NAL unit] entries. A packet is classified positive if any aggregated unit is.
function classifyStapA(rtpPayload: Buffer): NalClassification {
  let offset = 1
  let isIdr = false
  let isParameterSet = false
  while (offset + 2 <= rtpPayload.length) {
    const unitSize = rtpPayload.readUInt16BE(offset)
    offset += 2
    if (unitSize === 0 || offset >= rtpPayload.length) break
    const innerNalType = rtpPayload[offset] & NAL_TYPE_MASK
    const classification = classifySingleNalUnit(innerNalType)
    isIdr = isIdr || classification.isIdr
    isParameterSet = isParameterSet || classification.isParameterSet
    offset += unitSize
  }
  return { isIdr, isParameterSet }
}
