import { Axis } from '@visx/axis'
import { curveMonotoneX } from '@visx/curve'
import { Group } from '@visx/group'
import { scaleLinear, scaleBand } from '@visx/scale'
import { area, line } from 'd3-shape'
import { useMemo } from 'preact/hooks'

import type { HourlyEntry } from '@/lib/weather-types'

type ForecastChartProps = {
  hourly: HourlyEntry[]
}

const margin = { top: 24, right: 60, bottom: 56, left: 64 }
const chartHeight = 320

export function ForecastChart({ hourly }: ForecastChartProps) {
  const next24 = useMemo(() => hourly.slice(0, 24), [hourly])

  const width = 1920 - 48 // 1920 - px-12 padding
  const innerWidth = width - margin.left - margin.right

  const temperatures = next24.map((entry) => entry.temperature)

  const tempMin = Math.floor(Math.min(...temperatures) - 2)
  const tempMax = Math.ceil(Math.max(...temperatures) + 2)

  const indices = next24.map((_, i) => i)

  const xScale = scaleBand({
    range: [0, innerWidth],
    domain: indices,
    padding: 0.3,
  })

  const yTempScale = scaleLinear({
    range: [chartHeight, 0],
    domain: [tempMin, tempMax],
    nice: true,
  })

  const yPrecipScale = scaleLinear({
    range: [chartHeight, 0],
    domain: [0, 100],
  })

  const bandwidth = xScale.bandwidth()

  const centerX = (index: number): number => {
    const position = xScale(index) ?? 0
    return position + bandwidth / 2
  }

  // d3-shape v3 expects [x, y] tuples
  const points: [number, number][] = temperatures.map((temp, i) => [centerX(i), yTempScale(temp)])

  const areaGenerator = area<[number, number]>()
    .x(([x]) => x)
    .y(([, y]) => y)
    .y0(chartHeight)
    .curve(curveMonotoneX)

  const lineGenerator = line<[number, number]>()
    .x(([x]) => x)
    .y(([, y]) => y)
    .curve(curveMonotoneX)

  return (
    <div class="relative">
      <svg width={width} height={chartHeight + margin.top + margin.bottom}>
        <defs>
          <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>

        <Group left={margin.left} top={margin.top}>
          {/* Grid lines */}
          {yTempScale.ticks(5).map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={width - margin.left - margin.right}
              y1={yTempScale(tick)}
              y2={yTempScale(tick)}
              stroke="#1e293b"
              strokeWidth={1}
            />
          ))}

          {/* Precipitation bars */}
          {next24.map((entry, i) => {
            const barWidth = xScale.bandwidth()
            const barHeight = chartHeight - yPrecipScale(entry.precipitationProbability)
            return (
              <rect
                key={`precip-${i}`}
                x={xScale(i)}
                y={yPrecipScale(entry.precipitationProbability)}
                width={barWidth}
                height={barHeight}
                fill="#1e3a5f"
                opacity={0.5}
                rx={2}
              />
            )
          })}

          {/* Temperature area fill */}
          <path d={areaGenerator(points) || ''} fill="url(#tempGradient)" />

          {/* Temperature line */}
          <path
            d={lineGenerator(points) || ''}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Temperature dots */}
          {temperatures.map((temp, i) => (
            <circle
              key={`dot-${i}`}
              cx={centerX(i)}
              cy={yTempScale(temp)}
              r={4}
              fill="#60a5fa"
              stroke="#000"
              strokeWidth={2}
            />
          ))}

          {/* Left Y-axis (temperature) */}
          <Axis
            orientation="left"
            scale={yTempScale}
            tickLabelProps={{ fill: '#64748b', fontSize: 13 }}
            tickValues={yTempScale.ticks(5)}
            tickFormat={(v) => `${v}°`}
            hideAxisLine
            hideTicks
          />

          {/* Right Y-axis (precipitation %) */}
          <Axis
            orientation="right"
            scale={yPrecipScale}
            tickLabelProps={{ fill: '#475569', fontSize: 12 }}
            tickValues={[0, 25, 50, 75, 100]}
            tickFormat={(v) => `${v}%`}
            hideAxisLine
            hideTicks
          />

          {/* X-axis (hours) */}
          <Axis
            orientation="bottom"
            scale={scaleLinear({
              range: [0, innerWidth],
              domain: [0, 23],
            })}
            tickValues={[0, 4, 8, 12, 16, 20]}
            tickFormat={(value) => `${String(value).padStart(2, '0')}:00`}
            tickLabelProps={{
              fill: '#64748b',
              fontSize: 13,
              textAnchor: 'middle',
            }}
            hideAxisLine
            hideTicks
          />
        </Group>
      </svg>

      {/* Legend */}
      <div class="flex gap-8 px-8 pb-4">
        <div class="flex items-center gap-2">
          <div class="h-0.5 w-4 rounded-full bg-blue-400" />
          <span class="text-sm text-slate-400">Temperature (°C)</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="h-3 w-4 rounded-sm bg-slate-700 opacity-50" />
          <span class="text-sm text-slate-400">Precipitation (%)</span>
        </div>
      </div>
    </div>
  )
}
