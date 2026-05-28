import { useCallback, useEffect, useState } from 'preact/hooks'

import { fetchWeather, type WeatherData } from '../lib/weatherApi'

const DEFAULT_LAT = 37.7749
const DEFAULT_LON = -122.4194

function getCoords(): { lat: number; lon: number } {
  const lat = parseFloat(localStorage.getItem('weather-lat') ?? String(DEFAULT_LAT))
  const lon = parseFloat(localStorage.getItem('weather-lon') ?? String(DEFAULT_LON))
  return { lat: isNaN(lat) ? DEFAULT_LAT : lat, lon: isNaN(lon) ? DEFAULT_LON : lon }
}

export function useWeather() {
  const { lat, lon } = getCoords()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchWeather(lat, lon)
      setWeather(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather')
    } finally {
      setLoading(false)
    }
  }, [lat, lon])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  return { weather, loading, error }
}
