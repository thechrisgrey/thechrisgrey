import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

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
    // Vite 8 bundles with Rolldown (not Rollup). The object form of
    // `output.manualChunks` was REMOVED — Rolldown only accepts the function
    // form (deprecated) or its native `codeSplitting.groups`. We use the
    // non-deprecated `rolldownOptions.output.codeSplitting`: each group's
    // `test` regex matches the module's resolved path under node_modules, so
    // anchors ([\\/]…[\\/]) keep e.g. `react` from also capturing
    // `react-router`, `react-helmet-async`, or `@react-three/*`. `priority`
    // is a safety net so the more specific router group wins over vendor.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // react-router(-dom) — must be matched before the react vendor group.
            { name: 'router', test: /[\\/]react-router(?:-dom)?[\\/]/, priority: 30 },
            // React core only — anchored so it excludes react-router*, react-is,
            // react-helmet-async, react-fast-compare, react-use-measure, etc.
            { name: 'vendor', test: /[\\/]react(?:-dom)?[\\/]/, priority: 20 },
            // Sanity client + image-url + portable text renderer.
            {
              name: 'sanity',
              test: /[\\/](?:@sanity[\\/](?:client|image-url)|@portabletext[\\/]react)[\\/]/,
              priority: 20,
            },
            { name: 'cognito', test: /[\\/]@aws-sdk[\\/]client-cognito-identity-provider[\\/]/, priority: 20 },
            // `three` core only — leading [\\/]three[\\/] excludes @react-three/*.
            { name: 'three-vendor', test: /[\\/]three[\\/]/, priority: 20 },
            { name: 'gsap-vendor', test: /[\\/]gsap[\\/]/, priority: 20 },
          ],
        },
      },
    },
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        // Drop noisy logs but KEEP console.warn/error so production diagnostics
        // (e.g. why a Turnstile token couldn't be obtained, ErrorBoundary catches,
        // fetch failures) stay visible in the browser console for debugging.
        drop_console: ['log', 'info', 'debug', 'trace'],
      },
    },
  },
});
