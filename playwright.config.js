import { defineConfig } from '@playwright/test';

// All test backends are intercepted by fixtures. Never use project credentials.
const env = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY: 'local-test-public-key',
};
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || undefined,
    viewport: { width: 1440, height: 900 },
    permissions: ['camera', 'geolocation'],
    geolocation: { latitude: -7.4478, longitude: 112.7183 },
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'dev', use: { baseURL: 'http://127.0.0.1:5175' } },
    {
      name: 'preview',
      testMatch: /(flows|multi-photo)\.spec\.js/,
      use: { baseURL: 'http://127.0.0.1:4175' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 5175 --strictPort',
      url: 'http://127.0.0.1:5175',
      env,
      reuseExistingServer: false,
    },
    {
      command:
        'npm run build -- --mode e2e --outDir dist-test && npm run preview -- --host 127.0.0.1 --port 4175 --strictPort --outDir dist-test',
      url: 'http://127.0.0.1:4175',
      env,
      reuseExistingServer: false,
    },
  ],
});
