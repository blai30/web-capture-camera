import {
  Cloud,
  Cloudy,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
} from 'lucide-preact'

import type { WeatherCode } from '@/lib/weather-types'

type IconComponent = typeof Sun

const WEATHER_ICON_THRESHOLDS = [
  [1, Sun],
  [3, Cloudy],
  [48, CloudFog],
  [57, CloudDrizzle],
  [67, CloudRain],
  [77, CloudSnow],
  [82, CloudRain],
  [86, CloudSnow],
  [99, CloudLightning],
] as const satisfies ReadonlyArray<[number, IconComponent]>

export function getWeatherIcon(weatherCode: WeatherCode): IconComponent {
  for (const [threshold, icon] of WEATHER_ICON_THRESHOLDS) {
    if (weatherCode <= threshold) return icon
  }
  return Cloud
}
