import type { WeatherGroup } from '@/lib/weather-types'

// A palette is a set of CSS custom properties applied inline to the dashboard
// root. Components read them through arbitrary-value utilities, e.g.
// `text-(--text)` or `bg-(--surface)`.
export type Palette = Record<`--${string}`, string>

// Text and surface tokens are shared across every palette so contrast stays
// reliable on the streamed feed; only the background gradient and accent change.
const SHARED = {
  '--text': '#f8fafc',
  '--text-muted': 'rgba(241, 245, 249, 0.74)',
  '--surface': 'rgba(255, 255, 255, 0.06)',
}

function makePalette(backgroundFrom: string, backgroundTo: string, accent: string): Palette {
  return {
    '--background-from': backgroundFrom,
    '--background-to': backgroundTo,
    '--accent': accent,
    ...SHARED,
  }
}

const PALETTES: Record<WeatherGroup, { day: Palette; night: Palette }> = {
  clear: {
    day: makePalette('#0ea5e9', '#0369a1', '#fbbf24'),
    night: makePalette('#1e1b4b', '#0b1120', '#c7d2fe'),
  },
  cloudy: {
    day: makePalette('#64748b', '#334155', '#e2e8f0'),
    night: makePalette('#334155', '#0f172a', '#cbd5e1'),
  },
  fog: {
    day: makePalette('#94a3b8', '#64748b', '#f1f5f9'),
    night: makePalette('#475569', '#1e293b', '#e2e8f0'),
  },
  rain: {
    day: makePalette('#1d4ed8', '#1e3a8a', '#7dd3fc'),
    night: makePalette('#172554', '#0b1120', '#60a5fa'),
  },
  snow: {
    day: makePalette('#7dd3fc', '#3b82f6', '#f0f9ff'),
    night: makePalette('#334155', '#0f172a', '#e0f2fe'),
  },
  thunder: {
    day: makePalette('#5b21b6', '#312e81', '#fde047'),
    night: makePalette('#2e1065', '#0b1120', '#fde047'),
  },
}

export function paletteFor(group: WeatherGroup, isDay: boolean): Palette {
  const entry = PALETTES[group]
  return isDay ? entry.day : entry.night
}
