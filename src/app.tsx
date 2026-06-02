import { Dashboard } from '@/components/dashboard'

export function App() {
  return (
    <div class="flex h-screen items-start">
      {/* 1920x1080 */}
      <main class="w-480 h-270">
        <Dashboard />
      </main>
    </div>
  )
}
