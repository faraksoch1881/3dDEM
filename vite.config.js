import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'development' ? '/' : '/3dsub/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600, // Suppress 538 kB warning
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'], // Split Three.js
          geotiff: ['geotiff'], // Split GeoTIFF
          georaster: ['georaster'] // Split GeoRaster
        }
      }
    }
  },
  assetsInclude: ['**/*.tif'], // Include GeoTIFFs
  server: {
    open: '/', // Open root in dev
    host: true // Expose to network
  }
});