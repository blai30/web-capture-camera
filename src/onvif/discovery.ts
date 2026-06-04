import dgram from 'dgram'

import { onvifConfig, deviceConfig } from './config'

const MULTICAST_GROUP = '239.255.255.250'
const DISCOVERY_PORT = 3702

export class WsDiscovery {
  private socket: dgram.Socket | null = null
  private hostname: string
  private port: number
  private uuid: string

  constructor(options?: { hostname?: string; port?: number }) {
    this.hostname = options?.hostname ?? onvifConfig.hostname
    this.port = options?.port ?? onvifConfig.port
    this.uuid = onvifConfig.uuid
  }

  start(): void {
    this.socket = dgram.createSocket({
      type: 'udp4',
      reuseAddr: true,
    })
    this.socket.bind(
      {
        port: DISCOVERY_PORT,
        exclusive: false,
      },
      () => {
        try {
          this.socket?.addMembership(MULTICAST_GROUP)
        } catch {
          /* ignore membership errors */
        }
        console.log(`[WS-Discovery] Listening on port ${DISCOVERY_PORT}`)
      }
    )

    this.socket.on('message', (message) => {
      const text = message.toString()
      if (text.includes('Probe') && text.includes('NetworkVideoTransmitter')) {
        const probeMessageId = extractMessageId(text)
        if (probeMessageId) {
          this.sendProbeMatch(probeMessageId)
        }
      }
    })

    this.socket.on('error', (error) => {
      console.error('[WS-Discovery] Error:', error.message)
    })
  }

  stop(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  private sendProbeMatch(relatesTo: string): void {
    const messageId = 'uuid:' + generateUuid()
    const xaddr = `http://${this.hostname}:${this.port}/onvif/device_service`

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
      `<wsa:Address>urn:uuid:${this.uuid}</wsa:Address>` +
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
      this.socket?.send(response, DISCOVERY_PORT, MULTICAST_GROUP)
    } catch {
      /* silent on send failure */
    }
  }
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
