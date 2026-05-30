import type {
  WeatherData,
  CurrentWeather,
  HourlyEntry,
  DailyEntry,
  LocationConfig,
} from '@/lib/weather-types'

const CACHE_DURATION_MS = 10 * 60 * 1000 // 10 minutes

let cachedData: WeatherData | null = null
let cachedAt = 0

async function fetchConfig(): Promise<LocationConfig> {
  return {
    latitude: import.meta.env.VITE_WEATHER_LAT || 40.7128,
    longitude: import.meta.env.VITE_WEATHER_LON || -74.006,
    name: import.meta.env.VITE_WEATHER_NAME || 'New York',
  }
}

async function fetchFromOpenMeteo(location: LocationConfig): Promise<WeatherData> {
  const { latitude, longitude, name } = location

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index'
  )
  url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability')
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset'
  )
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`)
  }

  const json = await res.json()

  const current: CurrentWeather = {
    temperature: json.current.temperature_2m,
    apparentTemperature: json.current.apparent_temperature,
    weatherCode: json.current.weather_code,
    humidity: json.current.relative_humidity_2m,
    windSpeed: json.current.wind_speed_10m,
    windDirection: json.current.wind_direction_10m,
    pressure: json.current.surface_pressure,
    uvIndex: json.current.uv_index,
    precipitationProbability: 0,
  }

  // Derive current precipitation probability from hourly data
  const now = new Date().toISOString().slice(0, 13)
  const currentHourIndex = json.hourly.time.findIndex((t: string) => t >= now)
  if (currentHourIndex >= 0) {
    current.precipitationProbability = json.hourly.precipitation_probability[currentHourIndex] ?? 0
  }

  const hourly: HourlyEntry[] = json.hourly.time.map((time: string, i: number) => ({
    time,
    temperature: json.hourly.temperature_2m[i],
    weatherCode: json.hourly.weather_code[i],
    precipitationProbability: json.hourly.precipitation_probability[i] ?? 0,
  }))

  const daily: DailyEntry[] = json.daily.time.map((date: string, i: number) => ({
    date,
    temperatureMax: json.daily.temperature_2m_max[i],
    temperatureMin: json.daily.temperature_2m_min[i],
    weatherCode: json.daily.weather_code[i],
    precipitationProbabilityMax: json.daily.precipitation_probability_max[i] ?? 0,
    sunrise: json.daily.sunrise[i],
    sunset: json.daily.sunset[i],
  }))

  return {
    current,
    hourly,
    daily,
    locationName: name,
    updatedAt: new Date(),
  }
}

export async function getWeatherData(): Promise<WeatherData> {
  const location = await fetchConfig()

  // Use cache if still valid
  const now = Date.now()
  if (cachedData && now - cachedAt < CACHE_DURATION_MS) {
    return cachedData
  }

  const data = await fetchFromOpenMeteo(location)
  cachedData = data
  cachedAt = now
  return data
}
