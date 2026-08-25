import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // The ported admin panel. Two rules are relaxed here and nowhere else.
    files: ['src/admin/**/*.{ts,tsx}'],
    rules: {
      // The shell deliberately keeps its API — can(), useNav(), usePageChrome(),
      // useShell() — beside the components that define the contexts, and ui/ is a
      // barrel of 19 components plus the helpers they share. Splitting either to
      // win back fast refresh would scatter one contract across several files.
      // Structural, not a TODO.
      'react-refresh/only-export-components': 'off',
      // src/admin/engines/ is ~6000 lines of untyped ES5 ported verbatim from the
      // prototype, declared `any` on purpose because the whole layer is replaced
      // by HTTP calls later. Every view that calls it inherits that. TEMPORARY:
      // delete this line once the engines are behind typed API modules.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // scripts/ is the check suite: node scripts and the fixtures they bundle,
    // none of it shipped to a browser. `react-refresh/only-export-components`
    // is about surviving a Vite HMR update, which is not a thing that can
    // happen to a file only esbuild ever reads.
    files: ['scripts/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
