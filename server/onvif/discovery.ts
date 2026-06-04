import dgram from 'dgram'

import type { OnvifDevice } from './device'

const MULTICAST_GROUP = '239.255.255.250'
const DISCOVERY_PORT = 3702

export function createWsDiscovery(device: OnvifDevice) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  function start() {
    socket.bind({ port: DISCOVERY_PORT, exclusive: false }, () => {
      try {
        socket.addMembership(MULTICAST_GROUP)
      } catch {
        /* ignore membership errors */
      }
      console.log(`[WS-Discovery] Listening on port ${DISCOVERY_PORT}`)
    })

    socket.on('message', (message: Buffer) => {
      const text = message.toString()
      if (!text.includes('Probe') || !text.includes('NetworkVideoTransmitter')) return
      const probeMessageId = extractMessageId(text)
      if (!probeMessageId) return
      try {
        socket.send(device.probeMatchXml(probeMessageId), DISCOVERY_PORT, MULTICAST_GROUP)
      } catch {
        /* silent on send failure */
      }
    })

    socket.on('error', (error: Error) => {
      console.error('[WS-Discovery] Error:', error.message)
    })
  }

  const asyncDispose = async () => {
    socket.close()
  }

  return { start, [Symbol.asyncDispose]: asyncDispose }
}

function extractMessageId(xml: string): string | null {
  const match = xml.match(/<wsa:MessageID[^>]*>([^<]+)<\/wsa:MessageID>/)
  return match ? match[1] : null
}
