import fs from 'fs'
import http from 'http'

import soap from 'soap'

import { onvifConfig } from './config'
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
              GetProfiles: () => device.getProfilesResponse(),
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
