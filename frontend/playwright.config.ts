import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3102);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true, locale: 'vi-VN' },
  webServer: [{
    command: 'node dist/main.js',
    cwd: '../backend',
    env: { PORT: '3103', NODE_ENV: 'development', AUTH_PASSWORD_ONLY: 'true', CORS_ALLOWED_ORIGINS: `http://127.0.0.1:${port}` },
    url: 'http://127.0.0.1:3103/api/v1',
    reuseExistingServer: false,
    timeout: 30_000,
  }, {
    command: `node node_modules/next/dist/bin/next start -p ${port}`,
    env: { BACKEND_URL: 'http://127.0.0.1:3103' },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  }],
});
