import { CurrentConditions } from './components/CurrentConditions'
import { HourlyForecastChart } from './components/HourlyForecastChart'
import { useWeather } from './hooks/useWeather'

export function App() {
  const { weather, loading, error } = useWeather()

  if (loading) {
    return (
      <div class="flex h-screen flex-col items-center justify-center gap-6">
        <div class="h-16 w-16 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500" />
        <span class="text-2xl font-light text-white/60">Loading weather...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div class="flex h-screen flex-col items-center justify-center gap-4">
        <span class="text-2xl font-light text-red-400">Error loading weather</span>
        <span class="text-lg text-white/50">{error}</span>
      </div>
    )
  }

  if (!weather) return null

  return (
    <div class="flex flex-col bg-linear-to-b from-gray-950 via-gray-900 to-gray-950 px-16 py-10">
      <CurrentConditions weather={weather.current} />
      <div class="mt-8 flex flex-1 items-center">
        <HourlyForecastChart hourly={weather.hourly} />
      </div>
    </div>
  )
}
