import { Dashboard } from '@/components/dashboard'

export function App() {
  return (
    <div class="flex h-screen w-screen items-center justify-center bg-mist-900">
      {/* 1280x720 max, scales down to fit viewport while maintaining 16:9 */}
      <main class="aspect-video w-[min(min(100vw,--spacing(320)),calc(min(100vh,--spacing(180))*var(--aspect-video)))] bg-white dark:bg-black">
        <Dashboard />
      </main>
    </div>
  )
}
