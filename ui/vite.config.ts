import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: ['nas.fl0wer.cn', 'mobile.fl0wer.cn', 'localhost'],
      proxy: {
        '/api': {
          // Use VITE_API_BASE_URL for Docker compatibility
          // In Docker dev mode: VITE_API_BASE_URL=http://backend:28000
          // Local development: defaults to localhost:28000
          target: env.VITE_API_BASE_URL || 'http://localhost:28000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
      watch: {
        // Enable hot reload in Docker by watching for file changes
        usePolling: true,
        interval: 100,
      },
    },
  }
})