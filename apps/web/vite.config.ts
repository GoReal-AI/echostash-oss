import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // dev proxy to the control-plane server
      '/api': 'http://localhost:8080',
    },
  },
})
