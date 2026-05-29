import { Clock1, Droplets, Gauge, Wind } from 'lucide-preact'

import { getWeatherIcon } from '@/components/weather-icon'
import { getWindDirection, type CurrentWeather } from '@/lib/weather-types'

type CurrentWeatherProps = {
  current: CurrentWeather
}

export function CurrentWeather({ current }: CurrentWeatherProps) {
  const WeatherIcon = getWeatherIcon(current.weatherCode)

  return (
    <div class="flex items-start gap-8 p-8">
      <div class="flex shrink-0 items-center gap-6">
        <WeatherIcon size={80} class="text-slate-400" strokeWidth={1.5} />
        <div class="text-[10rem] leading-none font-light tracking-tighter">
          {Math.round(current.temperature)}
          <span class="text-6xl text-slate-500">°C</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-12 gap-y-3 text-left">
        <Stat label="Feels Like" value={`${Math.round(current.apparentTemperature)}°C`} />
        <Stat label="Humidity" value={`${current.humidity}%`} icon={Droplets} />
        <Stat
          label="Wind"
          value={`${Math.round(current.windSpeed)} km/h ${getWindDirection(current.windDirection)}`}
          icon={Wind}
        />
        <Stat label="UV Index" value={String(current.uvIndex)} />
        <Stat label="Pressure" value={`${Math.round(current.pressure)} hPa`} icon={Gauge} />
      </div>
    </div>
  )
}

type StatProps = {
  label: string
  value: string
  icon?: typeof Clock1
}

function Stat({ label, value, icon: Icon }: StatProps) {
  return (
    <div class="flex items-center gap-3">
      {Icon && <Icon size={18} class="shrink-0 text-slate-500" strokeWidth={1.5} />}
      <div>
        <div class="text-sm tracking-wider text-slate-500 uppercase">{label}</div>
        <div class="text-xl font-medium">{value}</div>
      </div>
    </div>
  )
}
