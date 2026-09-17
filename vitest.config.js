/* Test config lives apart from vite.config.js so the build config stays small.
   mergeConfig keeps the react plugin and resolve rules in sync automatically. */

import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // The lib modules under test are pure — no DOM needed, and node is faster.
      // Component tests, when they arrive, should opt into jsdom per-file with
      // an `@vitest-environment jsdom` docblock.
      environment: 'node',
      include: ['src/**/*.test.{js,jsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/lib/**/*.js'],
        reporter: ['text', 'html'],
      },
    },
  }),
)
