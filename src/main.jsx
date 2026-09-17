import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

/* Fonts are self-hosted rather than fetched from Google. Two reasons: the
   stylesheet link in index.html was render-blocking on a third party, which
   cost two serialised round trips (googleapis for the CSS, then gstatic for
   the woff2) before any text could paint; and Google Fonts logs visitor IPs,
   which is a live GDPR question once the app has public EU users.

   The weights below are exactly the ones the old <link> requested, so nothing
   renders differently. Only the latin and latin-ext subsets are imported —
   between them they cover every language this UI ships in, plus accented goal
   names — which is what the browser would have downloaded from Google anyway. */
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/latin-ext-500.css'
import '@fontsource/inter/latin-ext-600.css'

import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import '@fontsource/cormorant-garamond/latin-ext-500.css'
import '@fontsource/cormorant-garamond/latin-ext-600.css'
import '@fontsource/cormorant-garamond/latin-ext-500-italic.css'

import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-ext-500.css'

import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
