import { ArrowDown, ArrowUp, Droplets, Thermometer } from 'lucide-preact'
import type { ComponentChildren } from 'preact'

import { WeatherIcon } from '@/components/weather-icon'
import { describeWeatherCode } from '@/lib/weather-codes'
import type { CurrentWeather, DailyExtremes } from '@/lib/weather-types'

type CurrentConditionsProperties = {
  current: CurrentWeather
  daily: DailyExtremes
  temperatureUnit: string
}

type StatTileProperties = {
  icon: ComponentChildren
  value: ComponentChildren
  label: string
}

function StatTile({ icon, value, label }: StatTileProperties) {
  return (
    <div class="flex flex-col gap-1.5 rounded-2xl bg-(--surface) p-4 backdrop-blur-xl">
      <span class="text-(--accent)">{icon}</span>
      <span class="text-3xl font-bold text-(--text)">{value}</span>
      <span class="text-base font-medium tracking-wide text-(--text-muted) uppercase">{label}</span>
    </div>
  )
}

export function CurrentConditions({
  current,
  daily,
  temperatureUnit,
}: CurrentConditionsProperties) {
  const description = describeWeatherCode(current.weatherCode)

  return (
    <section class="flex h-full flex-col justify-between">
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-4">
          <span class="text-(--accent)">
            <WeatherIcon code={current.weatherCode} isDay={current.isDay} size={120} />
          </span>
          <span class="text-5xl font-medium text-(--text)">{description.label}</span>
        </div>

        <div class="flex items-start text-(--text)">
          <span class="text-[11rem] leading-none font-semibold">
            {Math.round(current.temperature)}
          </span>
          <span class="mt-5 text-7xl font-light text-(--text-muted)">{temperatureUnit}</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <StatTile
          icon={<Thermometer size={32} />}
          value={`${Math.round(current.apparentTemperature)}°`}
          label="Feels like"
        />
        <StatTile
          icon={
            <span class="flex gap-1">
              <ArrowUp size={32} />
              <ArrowDown size={32} />
            </span>
          }
          value={`${Math.round(daily.temperatureMax)}° / ${Math.round(daily.temperatureMin)}°`}
          label="High / Low"
        />
        <StatTile
          icon={<Droplets size={32} />}
          value={`${current.precipitation.toFixed(2)}"`}
          label="Precip"
        />
      </div>
    </section>
  )
}
