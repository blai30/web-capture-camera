import { clsx } from 'clsx/lite'

import type { WeatherGroup } from '@/lib/weather-types'

type ConditionBackdropProperties = {
  group: WeatherGroup
  isDay: boolean
}

// Full-bleed condition texture served from public/backdrops/<key>.webp.
// It is a CSS background (not an <img>) so a missing file renders nothing.
// The root gradient shows through the scrim, rather than a broken-image icon.
// The class strings are written out in full so Tailwind's JIT generates each url() rule.
const BACKDROP_IMAGE_CLASS: Record<string, string> = {
  'clear-day': 'bg-[url(/backdrops/clear-day.webp)]',
  'clear-night': 'bg-[url(/backdrops/clear-night.webp)]',
  cloudy: 'bg-[url(/backdrops/cloudy.webp)]',
  fog: 'bg-[url(/backdrops/fog.webp)]',
  rain: 'bg-[url(/backdrops/rain.webp)]',
  snow: 'bg-[url(/backdrops/snow.webp)]',
  thunder: 'bg-[url(/backdrops/thunder.webp)]',
}

function backdropKey(group: WeatherGroup, isDay: boolean): string {
  if (group === 'clear') {
    return isDay ? 'clear-day' : 'clear-night'
  }
  return group
}

export function ConditionBackdrop({ group, isDay }: ConditionBackdropProperties) {
  return (
    <div class="pointer-events-none absolute inset-0">
      <div
        class={clsx(
          'absolute inset-0 bg-cover bg-center',
          BACKDROP_IMAGE_CLASS[backdropKey(group, isDay)]
        )}
      />
      <div class="condition-scrim absolute inset-0" />
    </div>
  )
}
