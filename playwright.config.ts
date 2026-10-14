import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // iPhone-sized viewport with touch, rendered in Chromium.
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: `http://localhost:${port}`,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    serviceWorkers: 'block',
    // Pulsing elements never become "stable" for clicks; the app turns animation off for reduced motion.
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: `npx vite build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
