import type { HourlyForecast, WeatherData, WeatherGroup } from '@/lib/weather-types'

// Open-Meteo returns location-local ISO strings with no offset, and the UI reads
// the hour straight from characters 11-13, so any valid "YYYY-MM-DDTHH:00" works.
// A fixed base hour keeps preview frames deterministic.
const BASE_HOUR = 13

function buildHourly(weatherCode: number): HourlyForecast[] {
  const hourly: HourlyForecast[] = []
  for (let offset = 0; offset < 5; offset++) {
    const hour = String(BASE_HOUR + offset).padStart(2, '0')
    hourly.push({
      time: `2026-06-05T${hour}:00`,
      temperature: 70 + offset,
      weatherCode,
      precipitationProbability: 20 + offset * 10,
    })
  }
  return hourly
}

// Builds a complete, plausible WeatherData for a given condition so every preview
// cell renders a believable full frame, not just a coloured background.
export function makeWeatherData(
  weatherCode: number,
  isDay: boolean,
  overrides?: Partial<WeatherData>
): WeatherData {
  return {
    locationName: 'San Francisco',
    temperatureUnit: '°F',
    current: {
      temperature: 72,
      apparentTemperature: 70,
      weatherCode,
      isDay,
      precipitation: 0.12,
    },
    hourly: buildHourly(weatherCode),
    daily: {
      temperatureMax: 78,
      temperatureMin: 61,
    },
    ...overrides,
  }
}

export type PreviewScenario = {
  group: WeatherGroup
  label: string
  weatherCode: number
}

// One representative WMO code per condition group (verified against weather-codes.ts:
// 0 clear, 3 cloudy, 45 fog, 63 rain, 73 snow, 95 thunder).
export const SCENARIOS: PreviewScenario[] = [
  { group: 'clear', label: 'Clear', weatherCode: 0 },
  { group: 'cloudy', label: 'Cloudy', weatherCode: 3 },
  { group: 'fog', label: 'Fog', weatherCode: 45 },
  { group: 'rain', label: 'Rain', weatherCode: 63 },
  { group: 'snow', label: 'Snow', weatherCode: 73 },
  { group: 'thunder', label: 'Thunder', weatherCode: 95 },
]
