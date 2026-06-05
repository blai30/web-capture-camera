import { Droplets } from 'lucide-preact'

import { getWeatherIcon, getWeatherLabel } from '@/components/weather-icon'
import { useWeather } from '@/hooks/use-weather'
import { findCurrentHourIndex, formatHourLabel, isNighttime } from '@/lib/forecast'

const SECONDARY_TEXT = 'text-zinc-500 dark:text-zinc-400'
const ICON_COLOR = 'text-zinc-900 dark:text-zinc-100'

export function Dashboard() {
  const { data, error, loading } = useWeather()

  if (loading) {
    return (
      <div class="flex h-full items-center justify-center">
        <div class={`text-4xl ${SECONDARY_TEXT}`}>Loading weather data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="flex h-full items-center justify-center">
        <div class="text-4xl text-red-600 dark:text-red-400">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const { current, hourly, daily, locationName } = data
  const timeZone = import.meta.env.VITE_TIMEZONE || undefined

  const updatedAt = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(data.updatedAt)

  const currentHourIndex = findCurrentHourIndex(hourly, timeZone)
  const currentHourTime = hourly[currentHourIndex]?.time
  const currentIsNight = currentHourTime ? isNighttime(currentHourTime, daily) : false
  const CurrentIcon = getWeatherIcon(current.weatherCode, currentIsNight)

  const next5Hours = hourly.slice(currentHourIndex + 1, currentHourIndex + 6)

  return (
    <div class="flex h-full flex-col p-12">
      <header class={`flex items-baseline justify-between text-3xl ${SECONDARY_TEXT}`}>
        <span>{locationName}</span>
        <span>Updated {updatedAt}</span>
      </header>

      <section class="flex flex-1 items-center justify-between gap-8">
        <div class="flex flex-col">
          <span class="text-[12rem] leading-none font-semibold tabular-nums">
            {Math.round(current.temperature)}°
          </span>
          <span class="mt-6 text-6xl font-semibold">{getWeatherLabel(current.weatherCode)}</span>
          <span class={`mt-4 text-3xl ${SECONDARY_TEXT}`}>
            Feels like {Math.round(current.apparentTemperature)}°
          </span>
        </div>
        <CurrentIcon size={260} strokeWidth={1.5} class={`shrink-0 ${ICON_COLOR}`} />
      </section>

      <section class="grid grid-cols-5 gap-6 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        {next5Hours.map((entry) => {
          const HourIcon = getWeatherIcon(entry.weatherCode, isNighttime(entry.time, daily))
          return (
            <div key={entry.time} class="flex flex-col items-start gap-3">
              <span class={`text-3xl ${SECONDARY_TEXT}`}>{formatHourLabel(entry.time)}</span>
              <HourIcon size={72} strokeWidth={1.5} class={ICON_COLOR} />
              <span class="text-6xl font-semibold tabular-nums">
                {Math.round(entry.temperature)}°
              </span>
              {entry.precipitationProbability > 0 && (
                <span class="flex items-center gap-2 text-2xl text-sky-600 dark:text-sky-400">
                  <Droplets size={28} strokeWidth={2} />
                  {entry.precipitationProbability}%
                </span>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
