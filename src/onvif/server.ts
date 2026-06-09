import fs from 'fs'
import http from 'http'

import soap from 'soap'

import { createLogger } from '../log.ts'
import { onvifConfig } from './config.ts'
import { SNAPSHOT_PATH, type OnvifDevice } from './device.ts'

const logger = createLogger('onvif')

const deviceWSDL = fs.readFileSync(new URL('wsdl/device_service.wsdl', import.meta.url), 'utf8')
const mediaWSDL = fs.readFileSync(new URL('wsdl/media_service.wsdl', import.meta.url), 'utf8')

/** Returns the current JPEG frame for the snapshot endpoint, or null before the first capture. */
export type SnapshotSource = () => Uint8Array<ArrayBufferLike> | null

/**
 * Serves the ONVIF Device and Media SOAP services plus a JPEG snapshot endpoint over HTTP.
 *
 * @param device - The ONVIF device whose identity and SOAP responses are served.
 * @param options.port - Port to listen on. Defaults to the configured ONVIF port.
 * @param options.snapshotSource - Supplies the JPEG returned from the snapshot endpoint.
 */
export function createOnvifServer(
  device: OnvifDevice,
  options?: { port?: number; snapshotSource?: SnapshotSource }
) {
  const serverPort = options?.port ?? onvifConfig.port

  // This handler is the final fallback in node-soap's request-listener chain:
  // soap.listen() intercepts the two SOAP paths and delegates everything else here.
  const httpServer = http.createServer(
    (request: http.IncomingMessage, response: http.ServerResponse) => {
      const pathname = (request.url ?? '').split('?')[0]
      if (pathname === SNAPSHOT_PATH) {
        serveSnapshot(response, options?.snapshotSource?.() ?? null)
        return
      }
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
                  Uri: device.streamUri,
                  InvalidAfterConnect: false,
                  InvalidAfterReboot: false,
                  Timeout: 'PT30S',
                },
              }),
              GetSnapshotUri: () => ({
                MediaUri: {
                  Uri: device.snapshotUri,
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
        logger.info(`Server listening on port ${serverPort}`)
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

function serveSnapshot(response: http.ServerResponse, frame: Uint8Array<ArrayBufferLike> | null) {
  if (!frame) {
    response.writeHead(503)
    response.end('No frame available yet')
    return
  }
  // JPEG is mandated by ONVIF spec for GetSnapshotUri responses; required by UniFi Protect.
  response.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': frame.length,
  })
  response.end(frame)
}
