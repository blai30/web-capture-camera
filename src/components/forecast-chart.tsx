import { curveNatural } from '@visx/curve'
import { LinearGradient } from '@visx/gradient'
import { Group } from '@visx/group'
import { scaleLinear, scalePoint } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'

import type { HourlyForecast } from '@/lib/weather-types'

type ForecastChartProperties = {
  hourly: HourlyForecast[]
  width: number
  height: number
}

const VERTICAL_PADDING = 18
const AREA_GRADIENT_ID = 'forecast-area-gradient'

type ChartPoint = {
  x: number
  y: number
}

export function ForecastChart({ hourly, width, height }: ForecastChartProperties) {
  const temperatures = hourly.map((entry) => entry.temperature)
  const minimumTemperature = Math.min(...temperatures)
  const maximumTemperature = Math.max(...temperatures)
  const temperatureSpan = maximumTemperature - minimumTemperature || 1

  const horizontalScale = scalePoint<number>({
    domain: hourly.map((_, index) => index),
    range: [0, width],
    padding: 0.5,
  })
  const verticalScale = scaleLinear<number>({
    domain: [
      minimumTemperature - temperatureSpan * 0.6,
      maximumTemperature + temperatureSpan * 0.4,
    ],
    range: [height - VERTICAL_PADDING, VERTICAL_PADDING],
  })

  const points: ChartPoint[] = hourly.map((entry, index) => ({
    x: horizontalScale(index) ?? 0,
    y: verticalScale(entry.temperature),
  }))

  return (
    <svg width={width} height={height} class="overflow-visible">
      <LinearGradient
        id={AREA_GRADIENT_ID}
        from="var(--accent)"
        to="var(--accent)"
        fromOpacity={0.5}
        toOpacity={0.02}
      />
      <Group>
        <AreaClosed
          data={points}
          x={(point) => point.x}
          y={(point) => point.y}
          yScale={verticalScale}
          curve={curveNatural}
          fill={`url(#${AREA_GRADIENT_ID})`}
        />
        <LinePath
          data={points}
          x={(point) => point.x}
          y={(point) => point.y}
          curve={curveNatural}
          stroke="var(--accent)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        {points.map((point) => (
          <circle
            key={point.x}
            cx={point.x}
            cy={point.y}
            r={8}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth={4}
          />
        ))}
      </Group>
    </svg>
  )
}
