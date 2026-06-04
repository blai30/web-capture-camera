import fs from 'fs'
import http from 'http'

import soap from 'soap'

import { onvifConfig, profiles } from './config'
import type { OnvifDevice } from './device'

const deviceWSDL = fs.readFileSync(new URL('wsdl/device_service.wsdl', import.meta.url), 'utf8')
const mediaWSDL = fs.readFileSync(new URL('wsdl/media_service.wsdl', import.meta.url), 'utf8')

export function createOnvifServer(device: OnvifDevice, options?: { port?: number }) {
  const serverPort = options?.port ?? onvifConfig.port
  const httpServer = http.createServer(
    (_request: http.IncomingMessage, response: http.ServerResponse) => {
      response.writeHead(404)
      response.end('Not Found')
    }
  )

  async function start() {
    return new Promise<void>((resolve, reject) => {
      const mainProfile = profiles.main
      const subProfile = profiles.sub

      soap.listen(httpServer, {
        path: '/onvif/device_service',
        services: {
          DeviceService: {
            Device: {
              GetDeviceInformation: () => device.getDeviceInformation(),
              GetCapabilities: () => device.getCapabilities(),
              GetServices: () => device.getServicesResponse(),
              GetSystemDateAndTime: () => device.getSystemDateAndTime(),
            },
          },
        },
        xml: deviceWSDL,
        forceSoap12Headers: true,
      })

      soap.listen(httpServer, {
        path: '/onvif/media_service',
        services: {
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
                      Bounds: {
                        X: 0,
                        Y: 0,
                        Width: mainProfile.width,
                        Height: mainProfile.height,
                      },
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
                      Bounds: {
                        X: 0,
                        Y: 0,
                        Width: subProfile.width,
                        Height: subProfile.height,
                      },
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
              GetVideoSources: () => device.getVideoSources(),
              GetStreamUri: () => ({
                MediaUri: {
                  Uri: device.streamUri(),
                  InvalidAfterConnect: false,
                  InvalidAfterReboot: false,
                  Timeout: 'PT30S',
                },
              }),
              GetSnapshotUri: () => ({
                MediaUri: {
                  Uri: device.snapshotUri(),
                  InvalidAfterConnect: false,
                  InvalidAfterReboot: false,
                  Timeout: 'PT30S',
                },
              }),
            },
          },
        },
        xml: mediaWSDL,
        forceSoap12Headers: true,
      })

      httpServer.on('error', reject)
      httpServer.listen(serverPort, '0.0.0.0', () => {
        console.log(`[ONVIF] Server listening on port ${serverPort}`)
        resolve()
      })
    })
  }

  const asyncDispose = () =>
    new Promise<void>((resolve) => {
      httpServer.close(() => resolve())
    })

  return { start, [Symbol.asyncDispose]: asyncDispose }
}
