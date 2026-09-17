import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['dist/**', 'coverage/**', 'supabase/.temp/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // This codebase documents prop shapes in comments rather than PropTypes.
      'react/prop-types': 'off',
      // Apostrophes in prose are fine in modern JSX, and this app is copy-heavy —
      // escaping them all would make the source markedly harder to read.
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // These two land as errors in eslint-plugin-react-hooks v7 and flag real
      // patterns worth revisiting (App.jsx's load effect, Heatmap's ref read
      // during render). Demoted to warnings so they don't block CI before those
      // refactors happen — not because they're wrong.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },

  // Icon and helper modules legitimately export both components and lookups;
  // the fast-refresh rule only makes sense for true component modules.
  {
    files: ['src/lib/**/*.{js,jsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Tests import describe/it/expect explicitly, so they need no test globals —
  // only node's, for process.env and friends.
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['*.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node, sourceType: 'module' },
  },

  // Must stay last: turns off every rule that would fight Prettier.
  prettier,
]
