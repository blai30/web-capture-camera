import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createOnvifDevice } from './device.ts'

test('getStreamUriResponse wraps the RTSP URI in a MediaUri envelope', () => {
  const device = createOnvifDevice()
  const response = device.getStreamUriResponse()

  assert.match(response.MediaUri.Uri, /^rtsp:\/\/.+\/.+/)
  assert.equal(response.MediaUri.InvalidAfterConnect, false)
  assert.equal(response.MediaUri.InvalidAfterReboot, false)
  assert.equal(response.MediaUri.Timeout, 'PT30S')
})

test('getSnapshotUriResponse wraps the snapshot URI in a MediaUri envelope', () => {
  const device = createOnvifDevice()
  const response = device.getSnapshotUriResponse()

  assert.match(response.MediaUri.Uri, /^http:\/\/.+\/onvif\/snapshot$/)
  assert.equal(response.MediaUri.Timeout, 'PT30S')
})
