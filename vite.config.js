import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { elviaPwa } from './scripts/pwa/plugin.mjs'

// BASE_PATH sets where the build is served from, e.g. BASE_PATH=/Claude-code-game-test/ for a
// GitHub Pages project site (.github/workflows/pages.yml). Defaults to the site root.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    elviaPwa(),
  ],
  // Agent worktrees under .claude/ hold whole copies of the repo; keep their tests out of this run.
  test: { exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'] },
})
