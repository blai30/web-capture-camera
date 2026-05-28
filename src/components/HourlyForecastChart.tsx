import { curveMonotoneX } from '@visx/curve'
import { LinearGradient } from '@visx/gradient'
import { Group } from '@visx/group'
import { scaleLinear, scaleTime } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'
import {
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Cloud,
  Moon,
  Sun,
} from 'lucide-react'
import { useMemo } from 'preact/hooks'

import { wmoIcon, type HourlyWeather } from '../lib/weatherApi'

const LUCIDE_ICONS: Record<string, typeof Sun> = {
  Sun,
  Moon,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
}

const width = 1700
const height = 320
const margin = { top: 80, right: 40, bottom: 48, left: 40 }
const innerWidth = width - margin.left - margin.right
const innerHeight = height - margin.top - margin.bottom

function formatHour(time: string): string {
  const date = new Date(time)
  return date.toLocaleTimeString([], { hour: 'numeric', hour12: true })
}

export function HourlyForecastChart({ hourly }: { hourly: HourlyWeather[] }) {
  const hours = useMemo(() => {
    const now = new Date()
    return hourly.filter((hour) => new Date(hour.time) >= now).slice(0, 24)
  }, [hourly])

  if (!hours.length) return null

  const xScale = scaleTime({
    domain: [new Date(hours[0].time), new Date(hours[hours.length - 1].time)],
    range: [0, innerWidth],
  })
  const temps = hours.map((hour) => hour.temperature)
  const yScale = scaleLinear({
    domain: [Math.floor(Math.min(...temps) - 2), Math.ceil(Math.max(...temps) + 2)],
    range: [innerHeight, 0],
    nice: true,
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="w-full">
      <defs>
        <LinearGradient
          id="temp-gradient"
          from="rgba(59,130,246,0.4)"
          to="rgba(59,130,246,0.05)"
          vertical
        />
      </defs>

      <Group left={margin.left} top={margin.top}>
        <AreaClosed
          data={hours}
          x={(day) => xScale(new Date(day.time)) ?? 0}
          y={(day) => yScale(day.temperature) ?? 0}
          yScale={yScale}
          curve={curveMonotoneX}
          fill="url(#temp-gradient)"
        />
        <LinePath
          data={hours}
          x={(day) => xScale(new Date(day.time)) ?? 0}
          y={(day) => yScale(day.temperature) ?? 0}
          stroke="rgba(59,130,246,0.8)"
          strokeWidth={2}
          curve={curveMonotoneX}
        />

        {hours
          .filter((_, i) => i % 2 === 0)
          .map((hour) => {
            const x = xScale(new Date(hour.time)) ?? 0
            return (
              <g key={hour.time}>
                <foreignObject x={x - 20} y={margin.top - 56} width={40} height={40}>
                  <div class="flex h-full items-center justify-center">
                    {(() => {
                      const { icon } = wmoIcon(hour.weathercode)
                      const Icon = LUCIDE_ICONS[icon]
                      return Icon ? <Icon size={24} /> : null
                    })()}
                  </div>
                </foreignObject>

                <text
                  x={x}
                  y={margin.top + innerHeight + 28}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.6)"
                  fontSize={14}
                  fontFamily="var(--font-sans)"
                >
                  {formatHour(hour.time)}
                </text>

                <text
                  x={x}
                  y={yScale(hour.temperature) - 8}
                  textAnchor="middle"
                  fill="white"
                  fontSize={14}
                  fontWeight={500}
                  fontFamily="var(--font-sans)"
                >
                  {Math.round(hour.temperature)}°
                </text>
              </g>
            )
          })}
      </Group>
    </svg>
  )
}
