import { Dashboard } from '@/components/dashboard'

export function App() {
  return (
    <div class="flex h-screen items-start bg-mist-900">
      {/* 1280x720 */}
      <main class="aspect-video max-h-180 w-full max-w-7xl bg-white dark:bg-black">
        <Dashboard />
      </main>
    </div>
  )
}
