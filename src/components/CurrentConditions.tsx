import {
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Cloud,
  Moon,
  Sun,
} from 'lucide-react'
import { useMemo } from 'preact/hooks'

import { wmoIcon, type HourlyWeather } from '@/lib/weatherApi'

const ICONS: Record<string, typeof Sun> = {
  Sun,
  Moon,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
}

export function CurrentConditions({ weather }: { weather: HourlyWeather }) {
  const { icon, label } = wmoIcon(weather.weathercode)
  const Icon = ICONS[icon]
  const timestamp = useMemo(() => {
    return new Date(weather.time).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }, [weather.time])

  return (
    <div class="flex flex-col items-center gap-3">
      <div class="flex items-center gap-8">
        {Icon && <Icon size={80} />}
        <div class="flex flex-col items-start gap-2">
          <div class="flex items-baseline">
            <span class="text-8xl font-thin tracking-tighter">
              {Math.round(weather.temperature)}
            </span>
            <span class="text-4xl font-light text-white/60">°F</span>
          </div>
          <span class="text-2xl font-light text-white/70">{label}</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-24">
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm tracking-wider text-white/40 uppercase">Humidity</span>
          <span class="text-3xl font-light">{Math.round(weather.humidity)}%</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm tracking-wider text-white/40 uppercase">Wind</span>
          <span class="text-3xl font-light">
            {Math.round(weather.windspeed)}
            <span class="text-lg text-white/60"> mph</span>
          </span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm tracking-wider text-white/40 uppercase">UV Index</span>
          <span class="text-3xl font-light">{weather.uvIndex.toFixed(1)}</span>
        </div>
      </div>

      <span class="mt-2 text-sm text-white/30">{timestamp}</span>
    </div>
  )
}
