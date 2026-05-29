import { Clock as ClockIcon } from 'lucide-preact'

import { Clock } from '@/components/clock'
import { CurrentWeather } from '@/components/current-weather'
import { ForecastChart } from '@/components/forecast-chart'
import { useWeather } from '@/hooks/use-weather'

export function Dashboard() {
  const { data, error, loading } = useWeather()

  if (loading) {
    return (
      <div class="flex h-screen items-center justify-center gap-3 bg-black text-slate-400">
        <ClockIcon size={24} class="animate-pulse" />
        <span class="font-mono text-lg">Loading weather data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div class="flex h-screen items-center justify-center gap-3 bg-black text-red-400">
        <span class="text-lg">{error}</span>
      </div>
    )
  }

  if (!data) return null

  return (
    <div class="min-h-screen bg-black text-white">
      {/* Top bar: Clock + Location */}
      <div class="flex items-baseline justify-between border-b border-slate-800 px-12 pt-8 pb-4">
        <Clock />
        <div class="text-xl font-light tracking-wide text-slate-400">{data.locationName}</div>
      </div>

      {/* Current conditions */}
      <CurrentWeather current={data.current} />

      {/* 24-hour forecast chart */}
      <div class="px-12 pb-8">
        <div class="mb-2 text-sm tracking-wider text-slate-500 uppercase">24-Hour Forecast</div>
        <ForecastChart hourly={data.hourly} />
      </div>

      {/* Updated at */}
      <div class="px-12 pb-4">
        <div class="font-mono text-xs text-slate-600">
          Updated{' '}
          {data.updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
