import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    // CI (.github/workflows/ci.yml `cypress-mocked` job) runs ONLY the
    // mock-stubbed specs (404, about-pages, blog, blog-post, chat,
    // chat-agentic, contact). The WebGL-dependent specs (home, navigation,
    // mobile-navigation, chat-widget) rely on real Three.js and flake headless,
    // so they are dev/local only.
    setupNodeEvents() {
      // Node event listeners can be added here
    },
  },
});
