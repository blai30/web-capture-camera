import type { WeatherGroup } from '@/lib/weather-types'

// Returns the condition-reactive theme class to put on the dashboard root. The
// matching `.theme-*` rule (see index.css) sets the --background-from/to and
// --accent custom properties that the rest of the UI reads through utilities.
export function themeClassFor(group: WeatherGroup, isDay: boolean): string {
  return `theme-${group}-${isDay ? 'day' : 'night'}`
}
