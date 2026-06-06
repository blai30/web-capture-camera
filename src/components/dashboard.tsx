import { clsx } from 'clsx/lite'

import { ConditionBackdrop } from '@/components/condition-backdrop'
import { CurrentConditions } from '@/components/current-conditions'
import { DashboardHeader } from '@/components/dashboard-header'
import { ForecastPanel } from '@/components/forecast-panel'
import { themeClassFor } from '@/lib/theme'
import { describeWeatherCode } from '@/lib/weather-codes'
import type { WeatherData } from '@/lib/weather-types'

type DashboardProperties = {
  data: WeatherData
  updatedAt: Date | null
}

export function Dashboard({ data, updatedAt }: DashboardProperties) {
  const { group } = describeWeatherCode(data.current.weatherCode)

  return (
    <div
      class={clsx(
        'relative h-full w-full overflow-hidden bg-linear-to-b from-(--background-from) to-(--background-to)',
        themeClassFor(group, data.current.isDay)
      )}
    >
      <ConditionBackdrop group={group} isDay={data.current.isDay} />

      <div class="relative flex h-full w-full flex-col gap-8 p-12">
        <DashboardHeader locationName={data.locationName} updatedAt={updatedAt} />

        <div class="grid h-full grid-cols-2 gap-10">
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
