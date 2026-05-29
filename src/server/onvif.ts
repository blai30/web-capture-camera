import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const ONVIF_NS = 'http://www.onvif.org/ver10/schema'
const DEVICE_NS = 'http://www.onvif.org/ver10/device/wsdl'
const MEDIA_NS = 'http://www.onvif.org/ver10/media/wsdl'
const IMAGING_NS = 'http://www.onvif.org/ver20/imaging/wsdl'

interface OnvifServerConfig {
  host: string
  rtspPort: number
  deviceName: string
}

const deviceUuid = randomUUID()
const streamToken = 'stream_profile_1'

function getCapabilities(): string {
  return `
    <tt:Capabilities xmlns:tt="${ONVIF_NS}">
      <tt:Analytics>
        <tt:RuleEngine>false</tt:RuleEngine>
        <tt:AnalyticsEngine>false</tt:AnalyticsEngine>
      </tt:Analytics>
      <tt:Device>
        <tt:XAddr>http://${process.env.ONVIF_HOST ?? 'localhost'}:8000/onvif/device_service</tt:XAddr>
        <tt:Network>true</tt:Network>
        <tt:DiscoveryByLocation>false</tt:DiscoveryByLocation>
        <tt:DiscoveryByDevicePort>false</tt:DiscoveryByDevicePort>
        <tt:RemoteDiscovery>true</tt:RemoteDiscovery>
        <tt:SystemBackup>false</tt:SystemBackup>
        <tt:SystemLogging>false</tt:SystemLogging>
        <tt:FirmwareUpgrade>false</tt:FirmwareUpgrade>
        <tt:SupportedVersions>
          <tt:Major>02</tt:Major>
          <tt:Minor>41</tt:Minor>
        </tt:SupportedVersions>
        <tt:Extension>
          <tt:PasswordRevision>true</tt:PasswordRevision>
          <tt:HttpFirmwareUpgrade>false</tt:HttpFirmwareUpgrade>
          <tt:HttpSystemLogging>false</tt:HttpSystemLogging>
          <tt:HttpSystemBackup>false</tt:HttpSystemBackup>
          <tt:HttpPasswordRevision>false</tt:HttpPasswordRevision>
          <tt:HttpSupportInformation>false</tt:HttpSupportInformation>
        </tt:Extension>
      </tt:Device>
      <tt:Events>
        <tt:WssUrl>http://${process.env.ONVIF_HOST ?? 'localhost'}:8000/onvif/event_service</tt:WssUrl>
        <tt:SubscriptionPolicy>false</tt:SubscriptionPolicy>
        <tt:Extension />
      </tt:Events>
      <tt:Imaging>
        <tt:XAddr>http://${process.env.ONVIF_HOST ?? 'localhost'}:8000/onvif/Imaging_service</tt:XAddr>
      </tt:Imaging>
      <tt:Media>
        <tt:XAddr>http://${process.env.ONVIF_HOST ?? 'localhost'}:8000/onvif/media_service</tt:XAddr>
        <tt:Profile>false</tt:Profile>
        <tt:StreamingCapabilities>
          <tt:RTPMulticast>false</tt:RTPMulticast>
          <tt:RTP_TCP>true</tt:RTP_TCP>
          <tt:RTP_RTSP_TCP>true</tt:RTP_RTSP_TCP>
        </tt:StreamingCapabilities>
      </tt:Media>
      <tt:PTZ>
        <tt:XAddr>http://${process.env.ONVIF_HOST ?? 'localhost'}:8000/onvif/PTZ_service</tt:XAddr>
      </tt:PTZ>
    </tt:Capabilities>`
}

function getDeviceInformation(deviceName: string): string {
  return `
    <td:GetDeviceInformationResponse xmlns:td="${DEVICE_NS}">
      <td:Manufacturer>Weather Dashboard</td:Manufacturer>
      <td:Model>Virtual Camera</td:Model>
      <td:SerialNumber>${deviceUuid}</td:SerialNumber>
      <td:FirmwareVersion>1.0.0</td:FirmwareVersion>
      <td:HardwareId>1.0</td:HardwareId>
    </td:GetDeviceInformationResponse>`
}

function getProfiles(): string {
  return `
    <tr:GetProfilesResponse xmlns:tr="${MEDIA_NS}">
      <tr:Profiles>
        <tt:Profile xmlns:tt="${ONVIF_NS}">
          <tt:token>${streamToken}</tt:token>
          <tt:name>MainStream</tt:name>
          <tt:VideoSourceConfiguration>
            <tt:token>vs_1</tt:token>
            <tt:name>Video Source</tt:name>
            <tt:UseCount>1</tt:UseCount>
            <tt:SourceToken>0</tt:SourceToken>
          </tt:VideoSourceConfiguration>
          <tt:VideoEncoderConfiguration>
            <tt:token>ve_1</tt:token>
            <tt:name>H264 Encoder</tt:name>
            <tt:UseCount>1</tt:UseCount>
            <tt:Encoding>H264</tt:Encoding>
            <tt:Resolution>
              <tt:Width>1920</tt:Width>
              <tt:Height>1080</tt:Height>
            </tt:Resolution>
            <tt:Quality>4</tt:Quality>
            <tt:RateControl>
              <tt:FrameRateLimit>5</tt:FrameRateLimit>
              <tt:EncodingInterval>1</tt:EncodingInterval>
              <tt:BitrateLimit>2048</tt:BitrateLimit>
            </tt:RateControl>
            <tt:H264>
              <tt:GovLength>50</tt:GovLength>
              <tt:H264Profile>Baseline</tt:H264Profile>
            </tt:H264>
          </tt:VideoEncoderConfiguration>
        </tt:Profile>
      </tr:Profiles>
    </tr:GetProfilesResponse>`
}

function getStreamUri(rtspPort: number): string {
  const host = process.env.ONVIF_HOST ?? 'localhost'
  return `
    <tr:GetStreamUriResponse xmlns:tr="${MEDIA_NS}">
      <tr:MediaUri>
        <tt:Uri xmlns:tt="${ONVIF_NS}">rtsp://${host}:${rtspPort}/stream</tt:Uri>
        <tt:ExpirationPeriod xmlns:tt="${ONVIF_NS}">PT60S</tt:ExpirationPeriod>
      </tr:MediaUri>
    </tr:GetStreamUriResponse>`
}

function getNodes(): string {
  return `
    <td:GetNodesResponse xmlns:td="${IMAGING_NS}">
      <td:Nodes>
        <tt:Node xmlns:tt="${ONVIF_NS}">
          <tt:token>0</tt:token>
          <tt:Name>Virtual Source</tt:Name>
        </tt:Node>
      </td:Nodes>
    </td:GetNodesResponse>`
}

function getImagingSettings(): string {
  return `
    <ti:GetImagingSettingsResponse xmlns:ti="${IMAGING_NS}">
      <ti:ImagingSettings>
        <tt:Brightness xmlns:tt="${ONVIF_NS}">50</tt:Brightness>
        <tt:Contrast xmlns:tt="${ONVIF_NS}">50</tt:Contrast>
        <tt:Sharpness xmlns:tt="${ONVIF_NS}">50</tt:Sharpness>
      </ti:ImagingSettings>
    </ti:GetImagingSettingsResponse>`
}

function getSystemDateAndTime(): string {
  const now = new Date()
  return `
    <td:GetSystemDateAndTimeResponse xmlns:td="${DEVICE_NS}">
      <td:DateTimeType>Manual</td:DateTimeType>
      <td:DaylightSaving>false</td:DaylightSaving>
      <td:TimeZone>
        <td:TZ>${now.getTimezoneOffset() > 0 ? '-' : '+'}${String(Math.floor(Math.abs(now.getTimezoneOffset()) / 60)).padStart(2, '0')}:${String(Math.abs(now.getTimezoneOffset()) % 60).padStart(2, '0')}</td:TZ>
      </td:TimeZone>
      <td:UTCDateTime>
        <td:Time>
          <td:Hour>${now.getUTCHours()}</td:Hour>
          <td:Minute>${now.getUTCMinutes()}</td:Minute>
          <td:Second>${now.getUTCSeconds()}</td:Second>
        </td:Time>
        <td>Date>
          <td:Year>${now.getUTCFullYear()}</td:Year>
          <td:Month>${now.getUTCMonth() + 1}</td:Month>
          <td:Day>${now.getUTCDate()}</td:Day>
        </td:Date>
      </td:UTCDateTime>
    </td:GetSystemDateAndTimeResponse>`
}

function getScopes(): string {
  return `
    <td:GetScopesResponse xmlns:td="${DEVICE_NS}">
      <td:Scopes />
    </td:GetScopesResponse>`
}

function getServices(): string {
  return `
    <td:GetServicesResponse xmlns:td="${DEVICE_NS}">
      <td:Services>
        <td:Service>
          <td:Namespace>${DEVICE_NS}</td:Namespace>
          <td:XAddr>http://localhost:8000/onvif/device_service</td:XAddr>
          <td:Version>
            <td:Major>02</td:Major>
            <td:Minor>41</td:Minor>
          </td:Version>
        </td:Service>
        <td:Service>
          <td:Namespace>${MEDIA_NS}</td:Namespace>
          <td:XAddr>http://localhost:8000/onvif/media_service</td:XAddr>
          <td:Version>
            <td:Major>02</td:Major>
            <td:Minor>41</td:Minor>
          </td:Version>
        </td:Service>
        <td:Service>
          <td:Namespace>${IMAGING_NS}</td:Namespace>
          <td:XAddr>http://localhost:8000/onvif/Imaging_service</td:XAddr>
          <td:Version>
            <td:Major>02</td:Major>
            <td:Minor>41</td:Minor>
          </td:Version>
        </td:Service>
      </td:Services>
      <td:ServiceCapabilities>
        <td:MaxNumberOfUsers>0</td:MaxNumberOfUsers>
      </td:ServiceCapabilities>
    </td:GetServicesResponse>`
}

function getHost(): string {
  return process.env.ONVIF_HOST ?? 'localhost'
}

export function startOnvifServer(config: OnvifServerConfig) {
  const { rtspPort, deviceName } = config

  const server = createServer((req, res) => {
    const body: string[] = []

    req.on('data', (chunk: Buffer) => {
      body.push(chunk.toString())
    })

    req.on('end', () => {
      const soapBody = body.join('')
      let response = ''

      // Route based on SOAP action
      if (soapBody.includes('GetDeviceInformation')) {
        response = getDeviceInformation(deviceName)
      } else if (soapBody.includes('GetCapabilities')) {
        response = getCapabilities()
      } else if (soapBody.includes('GetProfiles')) {
        response = getProfiles()
      } else if (soapBody.includes('GetStreamUri')) {
        response = getStreamUri(rtspPort)
      } else if (soapBody.includes('GetNodes')) {
        response = getNodes()
      } else if (soapBody.includes('GetImagingSettings')) {
        response = getImagingSettings()
      } else if (soapBody.includes('GetSystemDateAndTime')) {
        response = getSystemDateAndTime()
      } else if (soapBody.includes('GetScopes')) {
        response = getScopes()
      } else if (soapBody.includes('GetServices')) {
        response = getServices()
      } else if (soapBody.includes('GetHostname')) {
        response = `<td:GetHostnameResponse xmlns:td="${DEVICE_NS}"><td:FromDHCP>true</td:FromDHCP><td:Name>${getHost()}</td:Name></td:GetHostnameResponse>`
      } else if (soapBody.includes('GetNetworkInterfaces')) {
        response = `
          <td:GetNetworkInterfacesResponse xmlns:td="${DEVICE_NS}">
            <td:Interfaces>
              <td:Interface>
                <td:Enabled>true</td:Enabled>
                <td:Info>
                  <td:Name>eth0</td:Name>
                  <td:Type>Ethernet</td:Type>
                </td:Info>
                <td:Link>
                  <td:AdministrativeState>Enabled</td:AdministrativeState>
                  <td:OperationalState>Up</td:OperationalState>
                </td:Link>
                <td:IPv4>
                  <td:AutoNegotiation>true</td:AutoNegotiation>
                  <td:Manual>
                    <td:Address>
                      <td:Type>Manual</td:Type>
                      <td:Address>${getHost()}</td:Address>
                    </td:Address>
                    <td:SubnetMask>255.255.255.0</td:SubnetMask>
                  </td:Manual>
                </td:IPv4>
              </td:Interface>
            </td:Interfaces>
          </td:GetNetworkInterfacesResponse>`
      } else if (soapBody.includes('GetNetworkProtocols')) {
        response = `
          <td:GetNetworkProtocolsResponse xmlns:td="${DEVICE_NS}">
            <td:NetworkProtocols>
              <td:Protocol>
                <td:Type>HTTP</td:Type>
                <td:Enabled>true</td:Enabled>
                <td:Port>8000</td:Port>
              </td:Protocol>
              <td:Protocol>
                <td:Type>HTTPS</td:Type>
                <td:Enabled>false</td:Enabled>
                <td:Port>443</td:Port>
              </td:Protocol>
              <td:Protocol>
                <td:Type>RTSP</td:Type>
                <td:Enabled>true</td:Enabled>
                <td:Port>${rtspPort}</td:Port>
              </td:Protocol>
            </td:NetworkProtocols>
          </td:GetNetworkProtocolsResponse>`
      } else if (soapBody.includes('GetUsers')) {
        response = `<td:GetUsersResponse xmlns:td="${DEVICE_NS}"><td:Users /></td:GetUsersResponse>`
      } else if (soapBody.includes('GetNTPSettings')) {
        response = `<td:GetNTPSettingsResponse xmlns:td="${DEVICE_NS}"><td:FromDHCP>true</td:FromDHCP><td:ManualNTPFromDHCP>false</td:ManualNTPFromDHCP><td:Enabled>false</td:Enabled><td:NTPTimeServers /></td:GetNTPSettingsResponse>`
      } else if (soapBody.includes('GetDNSSettings')) {
        response = `<td:GetDNSSettingsResponse xmlns:td="${DEVICE_NS}"><td:FromDHCP>true</td:FromDHCP><td:SearchDomains /></td:GetDNSSettingsResponse>`
      } else if (soapBody.includes('GetRTSPRedirect')) {
        response = `<td:GetRTSPRedirectResponse xmlns:td="${DEVICE_NS}"><td:RTSPRedirect>false</td:RTSPRedirect></td:GetRTSPRedirectResponse>`
      } else {
        console.log('Unknown ONVIF request:', soapBody.slice(0, 200))
        response = `<Fault xmlns="http://schemas.xmlsoap.org/soap/envelope/"><faultcode>soap:Client</faultcode><faultstring>Unknown action</faultstring></Fault>`
      }

      const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${response}</soap:Body>
</soap:Envelope>`

      res.writeHead(200, {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(envelope),
      })
      res.end(envelope)
    })
  })

  server.listen(8000, () => {
    console.log('ONVIF SOAP server listening on port 8000')
  })

  return server
}
