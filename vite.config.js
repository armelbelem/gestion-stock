import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'server/public',
    emptyOutDir: true,
  },
  server: {
    host: true, // Permet l'accès depuis d'autres ordinateurs sur le réseau
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
