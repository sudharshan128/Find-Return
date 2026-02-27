import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — loaded first, cached forever
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase SDK — large, rarely changes
          'vendor-supabase': ['@supabase/supabase-js'],
          // UI helpers
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          // Admin bundle — only loaded on /admin routes
          'admin': ['./src/admin/AdminApp'],
        },
      },
    },
  },
});
