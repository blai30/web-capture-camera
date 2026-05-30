import { getWeatherIcon } from '@/components/weather-icon'
import { type CurrentWeather } from '@/lib/weather-types'

const CONDITION_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
}

type Props = {
  current: CurrentWeather
  class?: string
}

export function CurrentWeather({ current, class: cls }: Props) {
  const Icon = getWeatherIcon(current.weatherCode)
  const label = CONDITION_LABELS[current.weatherCode] ?? 'Unknown'

  return (
    <div class={`flex flex-col justify-center ${cls ?? ''}`}>
      <div class="mb-6 flex items-center gap-4">
        <Icon size={40} class="shrink-0 text-slate-400" strokeWidth={1.5} />
        <span class="text-lg text-slate-400">{label}</span>
      </div>

      <div class="mb-6">
        <span class="text-[7rem] leading-none font-light tracking-tighter text-white">
          {Math.round(current.temperature)}
        </span>
        <span class="text-4xl font-light text-slate-500">°C</span>
      </div>

      <div class="flex items-center gap-6 text-sm text-slate-500">
        <div>
          <span class="text-slate-400">Feels like </span>
          {Math.round(current.apparentTemperature)}°
        </div>
        <div>
          <span class="text-slate-400">Humidity </span>
          {current.humidity}%
        </div>
        <div>
          <span class="text-slate-400">Wind </span>
          {Math.round(current.windSpeed)} km/h
        </div>
        <div>
          <span class="text-slate-400">Precip </span>
          {current.precipitationProbability}%
        </div>
      </div>
    </div>
  )
}
