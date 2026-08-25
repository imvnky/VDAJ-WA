import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Hardcode production API URL so Railway builds never fall back to localhost
    // VITE_API_BASE_URL from Railway env takes priority; this is the safety net
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'https://api.vdajservices.com/api/v1'
    ),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: true,
  },
  resolve: {
    extensions: ['.jsx', '.js'],
  },
});

