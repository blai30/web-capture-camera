import clsx from 'clsx/lite'

import { getWeatherIcon } from '@/components/weather-icon'
import { type CurrentWeather } from '@/lib/weather-types'

const CONDITION_LABELS: Record<number, string> = {
  0: 'Sunny',
  1: 'Mostly sunny',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Light fog',
  48: 'Foggy',
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

export function CurrentWeather({ current, class: className }: Props) {
  const Icon = getWeatherIcon(current.weatherCode)
  const condition = CONDITION_LABELS[current.weatherCode] ?? 'Unknown'

  return (
    <div class={clsx('flex items-center gap-12', className)}>
      <Icon class="size-80 shrink-0" strokeWidth={1.5} />
      <span class="text-8xl">{condition}</span>
    </div>
  )
}
