import fs from 'fs'
import http from 'http'

import soap from 'soap'

import { onvifConfig, deviceConfig, profiles, rtspConfig } from './config'

const deviceWSDL = fs.readFileSync(new URL('wsdl/device_service.wsdl', import.meta.url), 'utf8')
const mediaWSDL = fs.readFileSync(new URL('wsdl/media_service.wsdl', import.meta.url), 'utf8')

export class OnvifServer {
  private httpServer: http.Server
  private port: number

  constructor(options?: { port?: number }) {
    this.port = options?.port ?? onvifConfig.port
    this.httpServer = http.createServer((_req: http.IncomingMessage, res: http.ServerResponse) => {
      res.writeHead(404)
      res.end('Not Found')
    })
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const deviceService = this.createDeviceService()
      const mediaService = this.createMediaService()

      soap.listen(this.httpServer, {
        path: '/onvif/device_service',
        services: deviceService,
        xml: deviceWSDL,
        forceSoap12Headers: true,
      })

      soap.listen(this.httpServer, {
        path: '/onvif/media_service',
        services: mediaService,
        xml: mediaWSDL,
        forceSoap12Headers: true,
      })

      this.httpServer.on('error', reject)
      this.httpServer.listen(this.port, '0.0.0.0', () => {
        console.log(`[ONVIF] Server listening on port ${this.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.close(() => resolve())
    })
  }

  private createDeviceService() {
    return {
      DeviceService: {
        Device: {
          GetDeviceInformation: () => ({
            Manufacturer: deviceConfig.manufacturer,
            Model: deviceConfig.model,
            FirmwareVersion: deviceConfig.firmwareVersion,
            SerialNumber: deviceConfig.serialNumber,
            HardwareId: deviceConfig.hardwareId,
          }),
          GetCapabilities: (args: { Category?: string[] }) => {
            const category = Array.isArray(args.Category) ? args.Category : [args.Category]
            return {
              Capabilities: {
                Device: {
                  Network: {
                    IPFilter: true,
                  },
                  SystemCAPability: {
                    SupportedVersions: { Major: 2, Minor: 5 },
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
          },
          GetServices: () => ({
            Services: [
              {
                Name: 'Device',
                Namespace: 'http://www.onvif.org/ver10/device/wsdl',
                XAddr: `http://${onvifConfig.hostname}:${onvifConfig.port}/onvif/device_service`,
                Version: { Major: 2, Minor: 5 },
              },
              {
                Name: 'Media',
                Namespace: 'http://www.onvif.org/ver10/media/wsdl',
                XAddr: `http://${onvifConfig.hostname}:${onvifConfig.port}/onvif/media_service`,
                Version: { Major: 2, Minor: 5 },
              },
            ],
          }),
          GetSystemDateAndTime: () => ({
            DateTimeType: 'NTP',
            DaylightSavings: false,
            TimeZone: {
              StdTime: { Hour: -6, Minute: 0 },
              DaylightTime: { Hour: -1, Minute: 0 },
            },
            UTCTime: new Date().toISOString(),
            LocalTime: new Date().toLocaleString(),
          }),
        },
      },
    }
  }

  private createMediaService() {
    const mainProfile = profiles.main
    const subProfile = profiles.sub

    return {
      MediaService: {
        Media: {
          GetProfiles: () => ({
            Profiles: [
              {
                token: mainProfile.token,
                name: mainProfile.name,
                VideoSourceConfiguration: {
                  token: 'vs_' + mainProfile.token,
                  Name: mainProfile.name + '_VideoSource',
                  UseCount: 0,
                  SourceToken: '',
                  Bounds: { X: 0, Y: 0, Width: mainProfile.width, Height: mainProfile.height },
                },
                VideoEncoderConfiguration: {
                  token: 've_' + mainProfile.token,
                  Name: mainProfile.name + '_H264',
                  UseCount: 0,
                  Encoding: 'H264',
                  Resolution: { Width: mainProfile.width, Height: mainProfile.height },
                  Quality: mainProfile.quality,
                  RateControl: {
                    FrameRateLimit: mainProfile.framerate,
                    BitrateLimit: mainProfile.bitrate,
                    EncodingInterval: 1,
                  },
                  H264: {
                    GovLength: 50,
                    H264Profile: 'Main',
                    Level: 'H264Level4',
                  },
                },
              },
              {
                token: subProfile.token,
                name: subProfile.name,
                VideoSourceConfiguration: {
                  token: 'vs_' + subProfile.token,
                  Name: subProfile.name + '_VideoSource',
                  UseCount: 0,
                  SourceToken: '',
                  Bounds: { X: 0, Y: 0, Width: subProfile.width, Height: subProfile.height },
                },
                VideoEncoderConfiguration: {
                  token: 've_' + subProfile.token,
                  Name: subProfile.name + '_H264',
                  UseCount: 0,
                  Encoding: 'H264',
                  Resolution: { Width: subProfile.width, Height: subProfile.height },
                  Quality: subProfile.quality,
                  RateControl: {
                    FrameRateLimit: subProfile.framerate,
                    BitrateLimit: subProfile.bitrate,
                    EncodingInterval: 1,
                  },
                  H264: {
                    GovLength: 50,
                    H264Profile: 'Main',
                    Level: 'H264Level4',
                  },
                },
              },
            ],
          }),
          GetVideoSources: () => ({
            VideoSources: [
              {
                Token: 'video_source_0',
                Fixed: false,
                FrameRateLimit: 30,
                Resolution: { Width: 1280, Height: 720 },
              },
            ],
          }),
          GetStreamUri: (args: {
            ProfileToken: string
            StreamSetup?: { Stream?: string; Transport?: { Protocol?: string } }
          }) => {
            const profileToken = args.ProfileToken
            return {
              MediaUri: {
                Uri: `rtsp://${onvifConfig.hostname}:${rtspConfig.port}${rtspConfig.path}`,
                InvalidAfterConnect: false,
                InvalidAfterReboot: false,
                Timeout: 'PT30S',
              },
            }
          },
          GetSnapshotUri: () => {
            return {
              MediaUri: {
                Uri: `http://${onvifConfig.hostname}:5173`,
                InvalidAfterConnect: false,
                InvalidAfterReboot: false,
                Timeout: 'PT30S',
              },
            }
          },
        },
      },
    }
  }
}
