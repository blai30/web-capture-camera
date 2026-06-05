import { clsx } from 'clsx/lite'

import { ConditionBackdrop } from '@/components/condition-backdrop'
import { CurrentConditions } from '@/components/current-conditions'
import { DashboardHeader } from '@/components/dashboard-header'
import { ForecastPanel } from '@/components/forecast-panel'
import { useWeather } from '@/hooks/use-weather'
import { themeClassFor } from '@/lib/theme'
import { describeWeatherCode } from '@/lib/weather-codes'

export function Dashboard() {
  const { data, status, updatedAt } = useWeather()

  // Never stream a half-built frame: hold a quiet placeholder until data is ready.
  if (status !== 'ready' || !data) {
    return (
      <div class="flex h-full w-full items-center justify-center text-3xl">
        {status === 'error' ? 'Weather data unavailable' : 'Loading weather…'}
      </div>
    )
  }

  const { group } = describeWeatherCode(data.current.weatherCode)

  return (
    <div
      class={clsx(
        'relative h-full w-full overflow-hidden bg-linear-to-b from-(--background-from) to-(--background-to)',
        themeClassFor(group, data.current.isDay)
      )}
    >
      <ConditionBackdrop group={group} isDay={data.current.isDay} />

      <div class="relative grid h-full w-full grid-rows-[auto_1fr] gap-8 p-12">
        <DashboardHeader locationName={data.locationName} updatedAt={updatedAt} />

        <div class="grid min-h-0 grid-cols-[1.1fr_1fr] gap-10">
          <CurrentConditions
            current={data.current}
            daily={data.daily}
            temperatureUnit={data.temperatureUnit}
          />
          <ForecastPanel hourly={data.hourly} />
        </div>
      </div>
    </div>
  )
}
