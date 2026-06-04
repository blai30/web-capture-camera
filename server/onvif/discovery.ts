import dgram from 'dgram'

import { onvifConfig, deviceConfig } from './config'

const MULTICAST_GROUP = '239.255.255.250'
const DISCOVERY_PORT = 3702

export function createWsDiscovery(options?: { hostname?: string; port?: number }) {
  const socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
  })
  const hostname = options?.hostname ?? onvifConfig.hostname
  const port = options?.port ?? onvifConfig.port
  const uuid = onvifConfig.uuid

  function sendProbeMatch(relatesTo: string) {
    const messageId = 'uuid:' + generateUuid()
    const xaddr = `http://${hostname}:${port}/onvif/device_service`

    const response =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"` +
      ` xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"` +
      ` xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"` +
      ` xmlns:dn="http://www.onvif.org/ver10/network/wsdl">` +
      `<e:Header>` +
      `<wsa:MessageID>${messageId}</wsa:MessageID>` +
      `<wsa:RelatesTo>${relatesTo}</wsa:RelatesTo>` +
      `<wsa:To e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>` +
      `<wsa:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>` +
      `<d:AppSequence e:mustUnderstand="true" MessageNumber="0" InstanceId="${Math.floor(Math.random() * 2147483647)}"/>` +
      `</e:Header>` +
      `<e:Body>` +
      `<d:ProbeMatches>` +
      `<d:ProbeMatch>` +
      `<wsa:EndpointReference>` +
      `<wsa:Address>urn:uuid:${uuid}</wsa:Address>` +
      `</wsa:EndpointReference>` +
      `<d:Types>dn:NetworkVideoTransmitter</d:Types>` +
      `<d:Scopes>` +
      `onvif://www.onvif.org/type/video_encoder` +
      ` onvif://www.onvif.org/type/ptz` +
      ` onvif://www.onvif.org/hardware/${deviceConfig.manufacturer}` +
      ` onvif://www.onvif.org/name/${deviceConfig.model}` +
      `</d:Scopes>` +
      `<d:XAddrs>${xaddr}</d:XAddrs>` +
      `<d:MetadataVersion>1</d:MetadataVersion>` +
      `</d:ProbeMatch>` +
      `</d:ProbeMatches>` +
      `</e:Body>` +
      `</e:Envelope>`

    try {
      socket.send(response, DISCOVERY_PORT, MULTICAST_GROUP)
    } catch {
      /* silent on send failure */
    }
  }

  function start() {
    socket.bind(
      {
        port: DISCOVERY_PORT,
        exclusive: false,
      },
      () => {
        try {
          socket.addMembership(MULTICAST_GROUP)
        } catch {
          /* ignore membership errors */
        }
        console.log(`[WS-Discovery] Listening on port ${DISCOVERY_PORT}`)
      }
    )

    socket.on('message', (_message: Buffer, _info: { address: string; port: number }) => {
      const text = _message.toString()
      if (text.includes('Probe') && text.includes('NetworkVideoTransmitter')) {
        const probeMessageId = extractMessageId(text)
        if (probeMessageId) {
          sendProbeMatch(probeMessageId)
        }
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

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
