import { useEffect, useRef, useState } from 'preact/hooks'

const timezone = import.meta.env.VITE_WEATHER_TIMEZONE || 'UTC'

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(date)
}

export function Clock() {
  const [now, setNow] = useState(new Date())
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div class="font-mono">
      <div class="text-5xl font-semibold tracking-tight">{formatTime(now)}</div>
      <div class="text-lg text-slate-400">{formatDate(now)}</div>
    </div>
  )
}
