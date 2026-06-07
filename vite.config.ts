import path from 'path'

import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// Strips any import that resolves into src/dev/ before Rolldown sees the module
// graph in production builds. This guarantees the preview gallery and its fixtures
// are completely absent from the shipped bundle.
function stripDevImports(): Plugin {
  return {
    name: 'strip-dev-imports',
    enforce: 'pre',
    transform(code, id, options) {
      if (options?.ssr || !id.endsWith('main.tsx')) return
      // Replace every `import … from '…/dev/…'` line with an empty line so
      // Rolldown never sees the module as a dependency.
      return code.replace(/^import[^'"]*['"].*\/dev\/.*['"]\s*$/gm, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  server: {
    port: parseInt(process.env.APP_PORT ?? '5173', 10),
    strictPort: true,
  },
  preview: {
    port: parseInt(process.env.APP_PORT ?? '5173', 10),
    strictPort: true,
    host: true,
  },
  plugins: [command === 'build' ? stripDevImports() : null, preact(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
