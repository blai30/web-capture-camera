import { getWeatherIcon } from '@/components/weather-icon'
import { useWeather } from '@/hooks/use-weather'

const CONDITION_LABELS: Record<number, string> = {
  0: 'Sunny',
  1: 'Mostly sunny',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Foggy',
  48: 'Rime fog',
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

export function Dashboard() {
  const { data, error, loading } = useWeather()

  if (loading) {
    return (
      <div class="flex h-full items-center justify-center">
        <div class="text-zinc-400">Loading weather data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="flex h-full items-center justify-center">
        <div class="text-red-400">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const Icon = getWeatherIcon(data.current.weatherCode)
  const updatedAt = data.updatedAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div class="flex h-full items-center justify-center p-8">
      <div class="flex w-full max-w-full flex-col gap-8 rounded-3xl p-10 ring-1 dark:bg-white/5 dark:ring-white/10">
        {/* Location + time */}
        <div class="flex items-center justify-between">
          <div class="text-4xl font-medium tracking-wide text-zinc-200">{data.locationName}</div>
          <div class="text-2xl text-zinc-500">Updated {updatedAt}</div>
        </div>

        {/* Temperature + condition */}
        <div class="flex items-center gap-8">
          <div class="flex flex-1 items-baseline gap-2">
            <span class="text-9xl font-extralight tracking-tight text-white">
              {Math.round(data.current.temperature)}
            </span>
            <span class="text-7xl font-light text-zinc-400">°F</span>
          </div>
          <div class="flex flex-1 items-center gap-5">
            <div class="flex items-center justify-center">
              <Icon size={120} strokeWidth={1.5} class="text-zinc-100" />
            </div>
            <div class="flex flex-col gap-4">
              <span class="text-5xl font-medium text-zinc-100">
                {CONDITION_LABELS[data.current.weatherCode] ?? 'Unknown'}
              </span>
              <span class="text-3xl text-zinc-400">
                Feels like {Math.round(data.current.apparentTemperature)}°
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
