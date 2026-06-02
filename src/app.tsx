import { Dashboard } from '@/components/dashboard'

export function App() {
  return (
    <div class="flex h-screen items-start">
      {/* 1280x720 */}
      <main class="w-7xl h-180">
        <Dashboard />
      </main>
    </div>
  )
}
