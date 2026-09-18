import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* Only three screens animate: the landing page, the first-run greeting, and the
   mobile nav. All three are loaded on demand, but Rollup still hoisted the
   animation library into the shared chunk the entry point pulls in, so every
   desktop visit downloaded it to use none of it. Naming it here keeps it in a
   chunk of its own, fetched only alongside a screen that animates. */
const ANIMATION_PACKAGES = ['motion', 'motion-dom', 'motion-utils', 'framer-motion']

export default defineConfig({
  plugins: [react()],
  server: { open: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const inNodeModules = id.split('node_modules/').pop()
          if (ANIMATION_PACKAGES.some((p) => inNodeModules.startsWith(`${p}/`))) {
            return 'animation'
          }
        },
      },
    },
  },
})
