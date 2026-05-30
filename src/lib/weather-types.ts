export type WeatherCode = number

export type CurrentWeather = {
  temperature: number
  apparentTemperature: number
  weatherCode: WeatherCode
  humidity: number
  windSpeed: number
  windDirection: number
  pressure: number
  uvIndex: number
  precipitationProbability: number
}

export type HourlyEntry = {
  time: string
  temperature: number
  weatherCode: WeatherCode
  precipitationProbability: number
}

export type DailyEntry = {
  date: string
  temperatureMax: number
  temperatureMin: number
  weatherCode: WeatherCode
  precipitationProbabilityMax: number
  sunrise: string
  sunset: string
}

export type WeatherData = {
  current: CurrentWeather
  hourly: HourlyEntry[]
  daily: DailyEntry[]
  locationName: string
  updatedAt: Date
}

export type LocationConfig = {
  latitude: number
  longitude: number
  name: string
}
