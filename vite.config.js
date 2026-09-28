import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Send /api requests from the React app to the Express server.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
