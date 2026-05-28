import { useCallback, useEffect, useState } from 'preact/hooks'

import { fetchWeather, type WeatherData } from '@/lib/weatherApi'

const DEFAULT_LAT = 37.7749
const DEFAULT_LON = -122.4194

function getCoords(): { latitude: number; longitude: number } {
  const latitude = parseFloat(localStorage.getItem('weather-lat') ?? String(DEFAULT_LAT))
  const longitude = parseFloat(localStorage.getItem('weather-lon') ?? String(DEFAULT_LON))
  return {
    latitude: isNaN(latitude) ? DEFAULT_LAT : latitude,
    longitude: isNaN(longitude) ? DEFAULT_LON : longitude,
  }
}

export function useWeather() {
  const { latitude, longitude } = getCoords()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchWeather(latitude, longitude)
      setWeather(data)
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load weather')
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  return { weather, loading, error }
}
