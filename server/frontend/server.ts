import http from 'http'
import path from 'path'

import sirv from 'sirv'

const DEFAULT_PORT = 8080

// The dashboard SPA is a static build (dist/). It is loaded internally by the Puppeteer capturer and
// can also be opened by other LAN clients, so the server binds all interfaces rather than loopback.
const BIND_ADDRESS = '0.0.0.0'

export type FrontendServerOptions = {
  port?: number
  root?: string
}

export function createFrontendServer(options?: FrontendServerOptions) {
  const port = options?.port ?? parseInt(process.env.APP_PORT ?? String(DEFAULT_PORT), 10)
  const root = path.resolve(options?.root ?? process.env.STATIC_ROOT ?? path.resolve(process.cwd(), 'dist'))

  // The in-container address the Puppeteer capturer should navigate to. 127.0.0.1 (not localhost)
  // for the same IPv4-binding reason documented in index.ts.
  const url = `http://127.0.0.1:${port}/`

  // sirv (the static server vite preview is built on) handles content types, etags, range requests,
  // and traversal safety. `single` falls back to index.html so client-side routing works. In
  // production it pre-caches dist; in dev it does tolerant on-demand lookups (dist may not exist).
  const serveAssets = sirv(root, {
    single: true,
    etag: true,
    dev: process.env.NODE_ENV !== 'production',
  })

  const httpServer = http.createServer((request, response) => serveAssets(request, response))

  async function start() {
    return new Promise<void>((resolve, reject) => {
      httpServer.on('error', reject)
      httpServer.listen(port, BIND_ADDRESS, () => {
        console.log(`[Frontend] Serving ${root} on port ${port}`)
        resolve()
      })
    })
  }

  const asyncDispose = () =>
    new Promise<void>((resolve) => {
      httpServer.close(() => resolve())
    })

  return { url, start, [Symbol.asyncDispose]: asyncDispose }
}
