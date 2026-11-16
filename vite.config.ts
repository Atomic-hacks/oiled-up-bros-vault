import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = {
  '/api': {
    target: process.env.VITE_API_TARGET || 'http://127.0.0.1:5173',
    changeOrigin: false,
  },
}

export default defineConfig({
  plugins: [react()],
  // The normal app server embeds Vite and handles /api itself. These proxies
  // keep an accidentally started standalone Vite/preview process functional.
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})
