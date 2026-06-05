import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Snowflake,
  Sun,
  type LucideIcon,
} from 'lucide-preact'

import type { WeatherCode } from '@/lib/weather-types'

type WeatherCodeEntry = {
  day: LucideIcon
  night: LucideIcon
  label: string
}

const WEATHER_CODE_MAP: Record<number, WeatherCodeEntry> = {
  0: { day: Sun, night: Moon, label: 'Clear' },
  1: { day: Sun, night: Moon, label: 'Mainly Clear' },
  2: { day: CloudSun, night: CloudMoon, label: 'Partly Cloudy' },
  3: { day: Cloudy, night: Cloudy, label: 'Overcast' },
  45: { day: CloudFog, night: CloudFog, label: 'Fog' },
  48: { day: CloudFog, night: CloudFog, label: 'Fog' },
  51: { day: CloudDrizzle, night: CloudDrizzle, label: 'Drizzle' },
  53: { day: CloudDrizzle, night: CloudDrizzle, label: 'Drizzle' },
  55: { day: CloudDrizzle, night: CloudDrizzle, label: 'Drizzle' },
  56: { day: CloudDrizzle, night: CloudDrizzle, label: 'Freezing Drizzle' },
  57: { day: CloudDrizzle, night: CloudDrizzle, label: 'Freezing Drizzle' },
  61: { day: CloudRain, night: CloudRain, label: 'Rain' },
  63: { day: CloudRain, night: CloudRain, label: 'Rain' },
  65: { day: CloudRainWind, night: CloudRainWind, label: 'Heavy Rain' },
  66: { day: CloudRainWind, night: CloudRainWind, label: 'Freezing Rain' },
  67: { day: CloudRainWind, night: CloudRainWind, label: 'Freezing Rain' },
  71: { day: CloudSnow, night: CloudSnow, label: 'Snow' },
  73: { day: CloudSnow, night: CloudSnow, label: 'Snow' },
  75: { day: CloudSnow, night: CloudSnow, label: 'Snow' },
  77: { day: Snowflake, night: Snowflake, label: 'Snow Grains' },
  80: { day: CloudRain, night: CloudRain, label: 'Showers' },
  81: { day: CloudRain, night: CloudRain, label: 'Showers' },
  82: { day: CloudRainWind, night: CloudRainWind, label: 'Heavy Showers' },
  85: { day: CloudSnow, night: CloudSnow, label: 'Snow Showers' },
  86: { day: CloudSnow, night: CloudSnow, label: 'Snow Showers' },
  95: { day: CloudLightning, night: CloudLightning, label: 'Thunderstorm' },
  96: { day: CloudLightning, night: CloudLightning, label: 'Thunderstorm' },
  99: { day: CloudLightning, night: CloudLightning, label: 'Thunderstorm' },
}

const FALLBACK_ENTRY: WeatherCodeEntry = { day: Cloud, night: Cloud, label: '—' }

export function getWeatherIcon(weatherCode: WeatherCode, isNighttime: boolean): LucideIcon {
  const entry = WEATHER_CODE_MAP[weatherCode] ?? FALLBACK_ENTRY
  return isNighttime ? entry.night : entry.day
}

export function getWeatherLabel(weatherCode: WeatherCode): string {
  return (WEATHER_CODE_MAP[weatherCode] ?? FALLBACK_ENTRY).label
}
