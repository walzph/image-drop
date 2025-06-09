import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
//    proxy: {
//      '/api': {
//        target: 'http://ws-server-67723-backend.workspaces:3000',
//       changeOrigin: true,
//      }
//    },
	proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    allowedHosts: ['67723-3000.2.codesphere.com']
  }
});