/// <reference types="node" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base` doit correspondre au nom du dépôt pour GitHub Pages
// (https://<user>.github.io/belote-tournoi/). Sur un domaine
// dédié ou Cloudflare Pages, compiler avec BASE_PATH=/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/belote-tournoi/',
  plugins: [react()],
  test: {
    // jsdom pour tout le monde : les tests d'interface en ont besoin et
    // le domaine, purement fonctionnel, s'en accommode sans surcoût notable.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
