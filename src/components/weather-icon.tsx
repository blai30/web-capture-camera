import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
  Cloudy as SunDim,
} from 'lucide-preact'

import type { WeatherCode } from '@/lib/weather-types'

type IconComponent = typeof Sun

export function getWeatherIcon(weatherCode: WeatherCode): IconComponent {
  if (weatherCode <= 1) return Sun
  if (weatherCode <= 3) return SunDim
  if (weatherCode <= 48) return CloudFog
  if (weatherCode <= 57) return CloudDrizzle
  if (weatherCode <= 67) return CloudRain
  if (weatherCode <= 77) return CloudSnow
  if (weatherCode <= 82) return CloudRain
  if (weatherCode <= 86) return CloudSnow
  if (weatherCode <= 99) return CloudLightning
  return Cloud
}
