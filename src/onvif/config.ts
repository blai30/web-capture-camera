export const rtspConfig = {
  port: parseInt(process.env.RTSP_PORT ?? '554', 10),
  path: process.env.RTSP_PATH ?? '/weather',
}

export const onvifConfig = {
  port: parseInt(process.env.ONVIF_PORT ?? '8020', 10),
  hostname: process.env.DEVICE_HOSTNAME ?? 'localhost',
  uuid: process.env.DEVICE_UUID ?? 'a88b38fc-600a-4d5d-bcad-118f7ae79098',
}

export const deviceConfig = {
  manufacturer: process.env.DEVICE_MANUFACTURER ?? 'WeatherDash',
  model: process.env.DEVICE_MODEL ?? 'VirtualCamera',
  firmwareVersion: '2.0.0',
  serialNumber: 'weather-dash-0000',
  hardwareId: 'weather-dash-1001',
  macAddress: process.env.DEVICE_MAC ?? '2C:CF:67:F7:F2:49',
}

export interface ProfileConfig {
  name: string
  token: string
  width: number
  height: number
  framerate: number
  bitrate: number
  quality: number
}

export const profiles: Record<string, ProfileConfig> = {
  main: {
    name: 'MainStream',
    token: 'main_stream',
    width: 1280,
    height: 720,
    framerate: 1,
    bitrate: 1024,
    quality: 4,
  },
  sub: {
    name: 'SubStream',
    token: 'sub_stream',
    width: 1280,
    height: 720,
    framerate: 1,
    bitrate: 1024,
    quality: 1,
  },
}
