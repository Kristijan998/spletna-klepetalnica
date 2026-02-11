import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Lokalno (npm run dev): aplikacija je na http://localhost:5173/
  // Produkcija (npr. GitHub Pages): aplikacija je pod /webchat.io/
  base: mode === 'production' ? '/webchat.io/' : '/',
  logLevel: 'error', // Suppress warnings, only show errors
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ]
}));
