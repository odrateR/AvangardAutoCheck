import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'msedge', reducedMotion: 'reduce' },
  webServer: {
    command: 'npm run dev -- --show-interactive-dev-session=false',
    url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI,
    timeout: 60000
  }
});
