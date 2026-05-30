import { CurrentTemperature } from '@/components/current-temperature'
import { CurrentWeather } from '@/components/current-weather'
import { useWeather } from '@/hooks/use-weather'

export function Dashboard() {
  const { data, error, loading } = useWeather()

  if (loading) {
    return (
      <div class="flex h-screen items-start">
        <span class="font-mono text-lg">Loading weather data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div class="flex h-screen items-start">
        <span class="text-lg text-red-400">{error}</span>
      </div>
    )
  }

  if (!data) return null

  return (
    <div class="flex h-screen items-start">
      <div class="aspect-video w-full p-6">
        <main class="grid size-full grid-cols-3 grid-rows-2 gap-6">
          {/* Current conditions and temperature */}
          <CurrentWeather current={data.current} class="col-span-2" />
          <CurrentTemperature current={data.current} class="col-span-1" />
          {/* 12 hour forecast conditions chart */}
          <div class="col-span-3 border">12-hour forecast</div>
        </main>
      </div>
    </div>
  )
}
