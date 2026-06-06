import { useState } from 'preact/hooks'

import { Dashboard } from '@/components/dashboard'
import { makeWeatherData, SCENARIOS } from '@/dev/weather-fixtures'

// A fixed instant so the "Updated" line is deterministic across renders.
const FIXED_UPDATED_AT = new Date('2026-06-05T13:00:00')

export function Preview() {
  const [isDay, setIsDay] = useState(true)

  return (
    <div class="min-h-screen w-screen bg-mist-900 p-8 text-white">
      <header class="mb-8 flex items-center gap-6">
        <h1 class="text-3xl font-semibold">Condition preview</h1>
        <button
          type="button"
          onClick={() => setIsDay((previous) => !previous)}
          class="rounded-lg bg-white/10 px-4 py-2 text-lg font-medium hover:bg-white/20"
        >
          {isDay ? 'Showing: Day' : 'Showing: Night'}
        </button>
      </header>

      <div class="flex flex-wrap gap-8">
        {SCENARIOS.map((scenario) => (
          <div key={scenario.group} class="flex flex-col gap-2">
            <span class="text-lg font-medium text-white/80">{scenario.label}</span>
            {/* The dashboard is built for a 1280x720 viewport with fixed rem-based
                spacing, so we render it at full size and scale the whole thing down
                from the top-left. The outer box reserves the scaled footprint (half
                of 1280x720) so the flex grid lays the cells out correctly. */}
            <div class="h-90 w-160">
              <div class="h-180 w-7xl origin-top-left scale-[0.5]">
                <Dashboard
                  data={makeWeatherData(scenario.weatherCode, isDay)}
                  updatedAt={FIXED_UPDATED_AT}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
