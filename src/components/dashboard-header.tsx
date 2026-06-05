import { MapPin, RefreshCw } from 'lucide-preact'

type DashboardHeaderProperties = {
  locationName: string
  updatedAt: Date | null
}

// Empty VITE_TIMEZONE falls back to the runtime's timezone.
const TIME_ZONE = import.meta.env.VITE_TIMEZONE || undefined

// `updatedAt` is a real instant (Date.now of the last fetch), so converting it
// to the configured timezone with Intl is correct.
function formatUpdatedTime(updatedAt: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(updatedAt)
}

export function DashboardHeader({ locationName, updatedAt }: DashboardHeaderProperties) {
  return (
    <header class="flex items-center justify-between text-(--text)">
      <div class="flex items-center gap-4">
        <MapPin size={36} strokeWidth={2.25} />
        <span class="text-4xl font-semibold tracking-tight">{locationName}</span>
      </div>
      {updatedAt && (
        <div class="flex items-center gap-2.5 text-(--text-muted)">
          <RefreshCw size={30} strokeWidth={2.25} />
          <span class="font-mono text-3xl">Updated {formatUpdatedTime(updatedAt)}</span>
        </div>
      )}
    </header>
  )
}
