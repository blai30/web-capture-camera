import type { DailyEntry, HourlyEntry } from '@/lib/weather-types'

/**
 * Determine whether a given hourly timestamp falls during the night.
 *
 * Open-Meteo returns timestamps in the location's local time with no offset
 * (e.g. `2026-06-05T15:00`), and sunrise/sunset share the same format, so a
 * plain lexicographic string comparison is correct and avoids any timezone math.
 * Defaults to day when the matching day cannot be found.
 */
export function isNighttime(isoTime: string, daily: DailyEntry[]): boolean {
  const date = isoTime.slice(0, 10)
  const day = daily.find((entry) => entry.date.slice(0, 10) === date)
  if (!day) {
    return false
  }
  return isoTime < day.sunrise || isoTime >= day.sunset
}

/**
 * Format an hourly timestamp as a short clock label like `3 PM` or `12 AM`.
 *
 * The hour is read straight from the ISO string's hour field, which is already
 * the location's local hour, so no `Date`/timezone conversion is involved.
 */
export function formatHourLabel(isoTime: string): string {
  const hour = Number(isoTime.slice(11, 13))
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour} ${period}`
}

/**
 * Find the index of the current hour within the hourly forecast array.
 *
 * Builds a `YYYY-MM-DDTHH` key for "now" in the configured timezone (matching
 * the location-local format Open-Meteo uses) and returns the first entry at or
 * after it. Returns 0 when no entry matches (the array starts in the future).
 */
export function findCurrentHourIndex(hourly: HourlyEntry[], timeZone: string | undefined): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const currentHourKey = `${lookup('year')}-${lookup('month')}-${lookup('day')}T${lookup('hour')}`

  const index = hourly.findIndex((entry) => entry.time.slice(0, 13) >= currentHourKey)
  return index === -1 ? 0 : index
}
