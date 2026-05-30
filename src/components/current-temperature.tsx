import clsx from 'clsx/lite'

import { type CurrentWeather } from '@/lib/weather-types'

type Props = {
  current: CurrentWeather
  class?: string
}

export function CurrentTemperature({ current, class: className }: Props) {
  return (
    <div class={clsx('flex items-center justify-center', className)}>
      <div className="flex items-baseline">
        <span class="text-8xl">{Math.round(current.temperature)}</span>
        <span class="text-4xl">°F</span>
      </div>
    </div>
  )
}
