import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
        // Ensure we are replacing /api with /api/v1 correctly
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'), 
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    },
  },
})