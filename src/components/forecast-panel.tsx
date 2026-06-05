import { Droplet } from 'lucide-preact'

import { ForecastChart } from '@/components/forecast-chart'
import { WeatherIcon } from '@/components/weather-icon'
import type { HourlyForecast } from '@/lib/weather-types'

type ForecastPanelProperties = {
  hourly: HourlyForecast[]
}

const CHART_WIDTH = 470
const CHART_HEIGHT = 210

// Open-Meteo returns location-local times with no offset,
// so the hour is read straight from the string, no timezone conversion needed.
function readHour(isoTime: string): number {
  return Number(isoTime.slice(11, 13))
}

function formatHour(isoTime: string): string {
  const hour24 = readHour(isoTime)
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12} ${period}`
}

export function ForecastPanel({ hourly }: ForecastPanelProperties) {
  return (
    <section class="flex h-full flex-col gap-6 rounded-3xl border border-(--surface-border) bg-(--surface) p-8">
      <h2 class="text-xl font-semibold tracking-widest text-(--text-muted) uppercase">
        Next 5 hours
      </h2>

      <div class="flex flex-1 flex-col items-center justify-center gap-8">
        <div class="grid grid-cols-5 gap-2" style={{ width: `${CHART_WIDTH}px` }}>
          {hourly.map((entry) => (
            <div key={entry.time} class="flex flex-col items-center gap-2 text-(--text)">
              <span class="text-2xl font-medium text-(--text-muted)">{formatHour(entry.time)}</span>
              <div class="text-(--accent)">
                <WeatherIcon
                  code={entry.weatherCode}
                  isDay={readHour(entry.time) >= 6 && readHour(entry.time) < 19}
                  size={54}
                />
              </div>
              <span class="text-4xl font-bold">{Math.round(entry.temperature)}°</span>
              <span class="inline-flex items-center gap-1.5 text-xl text-(--text-muted)">
                <Droplet size={22} />
                {entry.precipitationProbability}%
              </span>
            </div>
          ))}
        </div>

        <ForecastChart hourly={hourly} width={CHART_WIDTH} height={CHART_HEIGHT} />
      </div>
    </section>
  )
}
