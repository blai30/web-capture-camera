import { onvifConfig, deviceConfig, rtspConfig, profiles, type ProfileConfig } from './config.ts'

const DEVICE_SERVICE_NAMESPACE = 'http://www.onvif.org/ver10/device/wsdl'
const MEDIA_SERVICE_NAMESPACE = 'http://www.onvif.org/ver10/media/wsdl'
const ONVIF_VERSION = { major: 2, minor: 5 }

/** HTTP path on the ONVIF server that serves the current frame as a snapshot image. */
export const SNAPSHOT_PATH = '/onvif/snapshot'

type OnvifService = {
  name: 'Device' | 'Media'
  namespace: string
  xaddr: string
  version: { major: number; minor: number }
}

export function createOnvifDevice() {
  const buildXaddr = (servicePath: string) =>
    `http://${onvifConfig.hostname}:${onvifConfig.port}/onvif/${servicePath}`

  const services: OnvifService[] = [
    {
      name: 'Device',
      namespace: DEVICE_SERVICE_NAMESPACE,
      xaddr: buildXaddr('device_service'),
      version: ONVIF_VERSION,
    },
    {
      name: 'Media',
      namespace: MEDIA_SERVICE_NAMESPACE,
      xaddr: buildXaddr('media_service'),
      version: ONVIF_VERSION,
    },
  ]

  const scopes = [
    'onvif://www.onvif.org/type/video_encoder',
    'onvif://www.onvif.org/type/ptz',
    `onvif://www.onvif.org/hardware/${deviceConfig.manufacturer}`,
    `onvif://www.onvif.org/name/${deviceConfig.model}`,
  ]

  const urn = `urn:uuid:${onvifConfig.uuid}`

  return {
    urn,
    hostname: onvifConfig.hostname,
    port: onvifConfig.port,
    services,
    scopes,
    probeMatchXml: (relatesTo: string) =>
      buildProbeMatchXml(services[0].xaddr, scopes, urn, relatesTo),
    getDeviceInformation,
    getCapabilities,
    getServicesResponse: () => buildServicesResponse(services),
    getSystemDateAndTime,
    getProfilesResponse,
    getVideoSources,
    streamUri: `rtsp://${onvifConfig.hostname}:${rtspConfig.port}${rtspConfig.path}`,
    snapshotUri: `http://${onvifConfig.hostname}:${onvifConfig.port}${SNAPSHOT_PATH}`,
  }
}

function buildProbeMatchXml(
  deviceXaddr: string,
  scopes: string[],
  urn: string,
  relatesTo: string
): string {
  const messageId = `uuid:${generateMessageUuid()}`
  const instanceId = Math.floor(Math.random() * 2147483647)
  return (
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
    `<d:AppSequence e:mustUnderstand="true" MessageNumber="0" InstanceId="${instanceId}"/>` +
    `</e:Header>` +
    `<e:Body>` +
    `<d:ProbeMatches>` +
    `<d:ProbeMatch>` +
    `<wsa:EndpointReference>` +
    `<wsa:Address>${urn}</wsa:Address>` +
    `</wsa:EndpointReference>` +
    `<d:Types>dn:NetworkVideoTransmitter</d:Types>` +
    `<d:Scopes>${scopes.join(' ')}</d:Scopes>` +
    `<d:XAddrs>${deviceXaddr}</d:XAddrs>` +
    `<d:MetadataVersion>1</d:MetadataVersion>` +
    `</d:ProbeMatch>` +
    `</d:ProbeMatches>` +
    `</e:Body>` +
    `</e:Envelope>`
  )
}

function getDeviceInformation() {
  return {
    Manufacturer: deviceConfig.manufacturer,
    Model: deviceConfig.model,
    FirmwareVersion: deviceConfig.firmwareVersion,
    SerialNumber: deviceConfig.serialNumber,
    HardwareId: deviceConfig.hardwareId,
  }
}

function getCapabilities() {
  return {
    Capabilities: {
      Device: {
        Network: { IPFilter: true },
        SystemCAPability: {
          SupportedVersions: { Major: ONVIF_VERSION.major, Minor: ONVIF_VERSION.minor },
        },
      },
      Media: {
        Profile: true,
        StreamingChains: true,
      },
      XT: {
        RTP_TCP: true,
      },
    },
  }
}

function buildServicesResponse(services: OnvifService[]) {
  return {
    Services: services.map((service) => ({
      Name: service.name,
      Namespace: service.namespace,
      XAddr: service.xaddr,
      Version: { Major: service.version.major, Minor: service.version.minor },
    })),
  }
}

function getSystemDateAndTime() {
  return {
    DateTimeType: 'NTP',
    DaylightSavings: false,
    TimeZone: {
      StdTime: { Hour: -6, Minute: 0 },
      DaylightTime: { Hour: -1, Minute: 0 },
    },
    UTCTime: new Date().toISOString(),
    LocalTime: new Date().toLocaleString(),
  }
}

function getProfilesResponse() {
  return {
    Profiles: Object.values(profiles).map(buildOnvifProfile),
  }
}

function getVideoSources() {
  return {
    VideoSources: [
      {
        Token: 'video_source_0',
        Fixed: false,
        FrameRateLimit: 30,
        Resolution: { Width: 1280, Height: 720 },
      },
    ],
  }
}

function buildOnvifProfile(profile: ProfileConfig) {
  return {
    token: profile.token,
    name: profile.name,
    VideoSourceConfiguration: {
      token: `vs_${profile.token}`,
      Name: `${profile.name}_VideoSource`,
      UseCount: 0,
      SourceToken: '',
      Bounds: { X: 0, Y: 0, Width: profile.width, Height: profile.height },
    },
    VideoEncoderConfiguration: {
      token: `ve_${profile.token}`,
      Name: `${profile.name}_H264`,
      UseCount: 0,
      Encoding: 'H264',
      Resolution: { Width: profile.width, Height: profile.height },
      Quality: profile.quality,
      RateControl: {
        FrameRateLimit: profile.framerate,
        BitrateLimit: profile.bitrate,
        EncodingInterval: 1,
      },
      H264: {
        GovLength: 50,
        H264Profile: 'Main',
        Level: 'H264Level4',
      },
    },
  }
}

export type OnvifDevice = ReturnType<typeof createOnvifDevice>

function generateMessageUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}
