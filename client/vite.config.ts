import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Internal port — users access the app via the Express server (port 3001)
    port: parseInt(process.env.VITE_PORT ?? '5174', 10),
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
