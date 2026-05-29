import { randomUUID } from 'node:crypto'
import { createSocket } from 'node:dgram'

interface WsDiscoveryConfig {
  host: string
  wsDiscoveryPort: number
}

const WS_DISCOVERY_MULTICAST = '239.255.255.250'
const WS_DISCOVERY_PORT = 3702

const deviceUuid = randomUUID()
const deviceEndpoint = `http://${process.env.ONVIF_HOST ?? 'localhost'}:8000/onvif/device_service`

function buildProbeMatches(probeId: string, probeTo: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
               xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery">
  <soap:Header>
    <wsa:MessageID>urn:uuid:${randomUUID()}</wsa:MessageID>
    <wsa:RelatesTo>${probeId}</wsa:RelatesTo>
    <wsa:ReplyTo>
      <wsa:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:Address>
    </wsa:ReplyTo>
    <wsa:To>${probeTo}</wsa:To>
    <wsd:AppSequence MessageNumber="0" InstanceId="0">
      <wsd:Identifier>urn:uuid:${randomUUID()}</wsd:Identifier>
    </wsd:AppSequence>
  </soap:Header>
  <soap:Body>
    <wsd:ProbeMatches>
      <wsd:ProbeMatch>
        <wsa:EndpointReference>
          <wsa:Address>urn:uuid:${deviceUuid}</wsa:Address>
        </wsa:EndpointReference>
        <wsd:Types>dn:NetworkVideoTransmitter tmd:OnvifDevice tmd:DeviceIO tmd:MediaIO tmd:VideoAnalytics</wsd:Types>
        <wsd:Scopes>onvif://www.onvif.org/type/VideoEncoder onvif://www.onvif.org/type/VideoSource onvif://www.onvif.org/name/WeatherDashboard</wsd:Scopes>
        <wsd:XAddrs>${deviceEndpoint}</wsd:XAddrs>
        <wsd:MetadataVersion>0</wsd:MetadataVersion>
      </wsd:ProbeMatch>
    </wsd:ProbeMatches>
  </soap:Body>
</soap:Envelope>`
}

function buildHello(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
               xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery">
  <soap:Header>
    <wsa:MessageID>urn:uuid:${randomUUID()}</wsa:MessageID>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Hello</wsa:Action>
  </soap:Header>
  <soap:Body>
    <wsd:Hello>
      <wsa:EndpointReference>
        <wsa:Address>urn:uuid:${deviceUuid}</wsa:Address>
      </wsa:EndpointReference>
      <wsd:Types>dn:NetworkVideoTransmitter tmd:OnvifDevice tmd:DeviceIO tmd:MediaIO tmd:VideoAnalytics</wsd:Types>
      <wsd:Scopes>onvif://www.onvif.org/type/VideoEncoder onvif://www.onvif.org/type/VideoSource onvif://www.onvif.org/name/WeatherDashboard</wsd:Scopes>
      <wsd:XAddrs>${deviceEndpoint}</wsd:XAddrs>
      <wsd:MetadataVersion>0</wsd:MetadataVersion>
    </wsd:Hello>
  </soap:Body>
</soap:Envelope>`
}

export function startWsDiscovery(config: WsDiscoveryConfig) {
  const socket = createSocket('udp4')

  socket.on('error', (err) => {
    console.error('WS-Discovery socket error:', err)
  })

  socket.on('message', (msg) => {
    const message = msg.toString()

    if (message.includes('Probe')) {
      // Extract MessageID and To from probe
      const messageIdMatch = message.match(/<wsa:MessageID>([^<]+)<\/wsa:MessageID>/)
      const toMatch = message.match(/<wsa:To>([^<]+)<\/wsa:To>/)

      if (messageIdMatch && toMatch) {
        const probeMatches = buildProbeMatches(messageIdMatch[1], toMatch[1])
        socket.send(probeMatches, (err) => {
          if (err) console.error('Failed to send ProbeMatches:', err)
        })
      }
    }
  })

  // Bind to multicast address
  socket.bind(config.wsDiscoveryPort, () => {
    socket.addMembership(WS_DISCOVERY_MULTICAST)
    console.log(
      `WS-Discovery responder listening on ${WS_DISCOVERY_MULTICAST}:${config.wsDiscoveryPort}`
    )
  })

  // Send Hello periodically
  const helloInterval = setInterval(() => {
    socket.send(buildHello(), WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST, (err) => {
      if (err) console.error('Failed to send Hello:', err)
    })
  }, 30000)

  // Send initial Hello
  socket.send(buildHello(), WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST)

  return {
    stop: () => {
      clearInterval(helloInterval)
      socket.close()
    },
  }
}
