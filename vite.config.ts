import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      // Only optimize images in assets/ (not public/ root files)
      include: ['**/*.{jpg,jpeg,png,webp}'],
      exclude: [/^[^/]+\.(jpg|jpeg|png|webp)$/], // Exclude root-level images (from public/)
      jpg: { quality: 80 },
      jpeg: { quality: 80 },
      png: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'sanity': ['@sanity/client', '@sanity/image-url', '@portabletext/react'],
          'router': ['react-router-dom'],
        }
      }
    },
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      }
    }
  }
})
