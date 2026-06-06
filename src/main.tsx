import { render } from 'preact'

import '@/index.css'
import { App } from '@/app.tsx'
import { Preview } from '@/dev/preview'

// Dev-only condition gallery. import.meta.env.DEV is statically false in production,
// so this branch (and the `<Preview />` reference) is dead-code-eliminated.
// The `Preview` import itself is removed by the `strip-dev-imports` plugin in
// vite.config.ts, because Rolldown does not drop dead-branch imports on its own,
// so the gallery and its fixtures can never reach the shipped bundle or the ONVIF feed.
const showPreview = import.meta.env.DEV && window.location.pathname === '/preview'

render(showPreview ? <Preview /> : <App />, document.getElementById('app')!)
