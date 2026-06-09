import dgram from 'dgram'

import { createLogger } from '../log.ts'
import type { OnvifDevice } from './device.ts'

const logger = createLogger('ws-discovery')

const MULTICAST_GROUP = '239.255.255.250'
const DISCOVERY_PORT = 3702

/**
 * Answers WS-Discovery Probe multicasts so ONVIF clients (NVRs) discover this device on the LAN.
 * Call `start()` to begin listening; replies are unicast back to each prober.
 */
export function createWsDiscovery(device: OnvifDevice) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  function start() {
    socket.bind({ port: DISCOVERY_PORT, exclusive: false }, () => {
      try {
        socket.addMembership(MULTICAST_GROUP)
      } catch {
        /* ignore membership errors */
      }
      logger.info(`Listening on port ${DISCOVERY_PORT}`)
    })

    socket.on('message', (message: Buffer, remoteInfo: dgram.RemoteInfo) => {
      const text = message.toString()
      // Respond to Probe requests only, not to ProbeMatches replies from other devices.
      if (!text.includes('Probe') || text.includes('ProbeMatches')) return
      const probeMessageId = extractMessageId(text)
      if (!probeMessageId) return
      try {
        // WS-Discovery replies are unicast back to the sender's source address and
        // port, not to the multicast group. The probing client listens for the
        // ProbeMatch on the ephemeral port it sent from.
        socket.send(device.probeMatchXml(probeMessageId), remoteInfo.port, remoteInfo.address)
      } catch {
        /* silent on send failure */
      }
    })

    socket.on('error', (error: Error) => {
      logger.error(`Error: ${error.message}`)
    })
  }

  const asyncDispose = async () => {
    socket.close()
  }

  return { start, [Symbol.asyncDispose]: asyncDispose }
}

function extractMessageId(xml: string): string | null {
  // Match MessageID regardless of namespace prefix (wsa:, a:, w:, or none),
  // since ONVIF clients differ in which WS-Addressing prefix they use.
  const match = xml.match(/<(?:\w+:)?MessageID[^>]*>([^<]+)<\/(?:\w+:)?MessageID>/)
  return match ? match[1].trim() : null
}
