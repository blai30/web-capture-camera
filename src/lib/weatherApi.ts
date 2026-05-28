const WEATHER_CACHE_MS = 10 * 60 * 1000

type HourlyWeather = {
  time: string
  temperature: number
  windspeed: number
  humidity: number
  precipitation: number
  weathercode: number
  uvIndex: number
}

type WeatherData = {
  current: HourlyWeather
  hourly: HourlyWeather[]
  latitude: number
  longitude: number
  timezone: string
}

type WmoIconType =
  | 'Sun'
  | 'Cloud'
  | 'CloudDrizzle'
  | 'CloudRain'
  | 'CloudSnow'
  | 'CloudLightning'
  | 'CloudFog'
  | 'Moon'
  | 'CloudMoon'

type WeatherDescription = {
  icon: WmoIconType
  label: string
}

function wmoIcon(code: number): WeatherDescription {
  const table: Record<number, WeatherDescription> = {
    0: { icon: 'Sun', label: 'Clear sky' },
    1: { icon: 'Sun', label: 'Mainly clear' },
    2: { icon: 'Cloud', label: 'Partly cloudy' },
    3: { icon: 'Cloud', label: 'Overcast' },
    45: { icon: 'CloudFog', label: 'Fog' },
    48: { icon: 'CloudFog', label: 'Depositing rime fog' },
    51: { icon: 'CloudDrizzle', label: 'Light drizzle' },
    53: { icon: 'CloudDrizzle', label: 'Moderate drizzle' },
    55: { icon: 'CloudDrizzle', label: 'Dense drizzle' },
    56: { icon: 'CloudDrizzle', label: 'Light freezing drizzle' },
    57: { icon: 'CloudDrizzle', label: 'Dense freezing drizzle' },
    61: { icon: 'CloudRain', label: 'Slight rain' },
    63: { icon: 'CloudRain', label: 'Moderate rain' },
    65: { icon: 'CloudRain', label: 'Heavy rain' },
    66: { icon: 'CloudRain', label: 'Light freezing rain' },
    67: { icon: 'CloudRain', label: 'Heavy freezing rain' },
    71: { icon: 'CloudSnow', label: 'Slight snowfall' },
    73: { icon: 'CloudSnow', label: 'Moderate snowfall' },
    75: { icon: 'CloudSnow', label: 'Heavy snowfall' },
    77: { icon: 'CloudSnow', label: 'Snow grains' },
    80: { icon: 'CloudRain', label: 'Slight rain showers' },
    81: { icon: 'CloudRain', label: 'Moderate rain showers' },
    82: { icon: 'CloudRain', label: 'Violent rain showers' },
    85: { icon: 'CloudSnow', label: 'Slight snow showers' },
    86: { icon: 'CloudSnow', label: 'Heavy snow showers' },
    95: { icon: 'CloudLightning', label: 'Thunderstorm' },
    96: { icon: 'CloudLightning', label: 'Thunderstorm with hail' },
    99: { icon: 'CloudLightning', label: 'Thunderstorm with heavy hail' },
    100: { icon: 'CloudRain', label: 'Tornado' },
    103: { icon: 'CloudLightning', label: 'Hurricane' },
    110: { icon: 'CloudLightning', label: 'Tornado' },
    113: { icon: 'CloudLightning', label: 'Hurricane' },
  }
  return table[code] || { icon: 'Cloud', label: 'Unknown' }
}

const cache: Record<string, { data: WeatherData; timestamp: number }> = {}

async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const cacheKey = `${latitude},${longitude}`
  const cached = cache[cacheKey]
  if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_MS) {
    return cached.data
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,windspeed_10m,relative_humidity_2m,precipitation,weather_code,uv_index'
  )
  url.searchParams.set(
    'hourly',
    'temperature_2m,windspeed_10m,relative_humidity_2m,precipitation,weather_code,uv_index'
  )
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '2')

  const response = await fetch(url.toString())
  const json = await response.json()

  const now = new Date()
  const currentHourIndex = json.hourly.time.findIndex((t: string) => {
    const date = new Date(t)
    return date <= now && new Date(date.getTime() + 3600000) > now
  })
  const index = currentHourIndex >= 0 ? currentHourIndex : 0

  const result: WeatherData = {
    current: {
      time: json.hourly.time[index],
      temperature: json.current.temperature_2m ?? json.hourly.temperature_2m[index],
      windspeed: json.current.windspeed_10m ?? json.hourly.windspeed_10m[index],
      humidity: json.current.relative_humidity_2m ?? json.hourly.relative_humidity_2m[index],
      precipitation: json.current.precipitation ?? json.hourly.precipitation[index],
      weathercode: json.current.weather_code ?? json.hourly.weather_code[index],
      uvIndex: json.current.uv_index ?? json.hourly.uv_index[index],
    },
    hourly: json.hourly.time.map((time: string, i: number) => ({
      time,
      temperature: json.hourly.temperature_2m[i],
      windspeed: json.hourly.windspeed_10m[i],
      humidity: json.hourly.relative_humidity_2m[i],
      precipitation: json.hourly.precipitation[i],
      weathercode: json.hourly.weather_code[i],
      uvIndex: json.hourly.uv_index[i],
    })),
    latitude: json.latitude,
    longitude: json.longitude,
    timezone: json.timezone,
  }

  cache[cacheKey] = { data: result, timestamp: Date.now() }
  return result
}

export { fetchWeather, wmoIcon, type WeatherData, type HourlyWeather, type WmoIconType }
