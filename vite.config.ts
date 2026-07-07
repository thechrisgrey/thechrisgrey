import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { execSync } from 'child_process';

// Git commit hash for RUM release ID (source map resolution in CloudWatch).
// Amplify sets AWS_COMMIT_ID during builds; fall back to local git, then 'dev'.
function getReleaseId(): string {
  if (process.env.AWS_COMMIT_ID) return process.env.AWS_COMMIT_ID.substring(0, 12);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

const releaseId = getReleaseId();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      include: ['**/*.{jpg,jpeg,png,webp}'],
      exclude: [/^[^/]+\.(jpg|jpeg|png|webp)$/],
      jpg: { quality: 80 },
      jpeg: { quality: 80 },
      png: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
  define: {
    'import.meta.env.VITE_RUM_RELEASE_ID': JSON.stringify(releaseId),
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'router', test: /[\\/]react-router(?:-dom)?[\\/]/, priority: 30 },
            { name: 'vendor', test: /[\\/]react(?:-dom)?[\\/]/, priority: 20 },
            {
              name: 'sanity',
              test: /[\\/](?:@sanity[\\/](?:client|image-url)|@portabletext[\\/]react)[\\/]/,
              priority: 20,
            },
            { name: 'cognito', test: /[\\/]@aws-sdk[\\/]client-cognito-identity-provider[\\/]/, priority: 20 },
            { name: 'three-vendor', test: /[\\/]three[\\/]/, priority: 20 },
            { name: 'gsap-vendor', test: /[\\/]gsap[\\/]/, priority: 20 },
          ],
        },
      },
    },
    // Hidden sourcemaps: generated for RUM source map upload to S3, but not
    // referenced in the build output (not deployed publicly).
    sourcemap: 'hidden',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: ['log', 'info', 'debug', 'trace'],
      },
    },
  },
});
