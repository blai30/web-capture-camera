import { CurrentConditions } from '@/components/current-conditions'
import { DashboardHeader } from '@/components/dashboard-header'
import { ForecastPanel } from '@/components/forecast-panel'
import { useWeather } from '@/hooks/use-weather'
import { paletteFor } from '@/lib/theme'
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
  const palette = paletteFor(group, data.current.isDay)

  return (
    <div
      class="grid h-full w-full grid-rows-[auto_1fr] gap-8 bg-linear-to-b from-(--background-from) to-(--background-to) p-12"
      style={palette}
    >
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
  )
}
