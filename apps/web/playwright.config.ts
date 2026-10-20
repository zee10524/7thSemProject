import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
// The smoke test needs a MongoDB (docker compose up mongo, or the CI service container).
const mongo = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/litsense_e2e';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start:dev -w @litsense/api',
      cwd: '../..',
      url: 'http://localhost:4000/healthz',
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'warn',
        PORT: '4000',
        MONGODB_URI: mongo,
        REDIS_URL: '',
        MODEL_SERVICE_MODE: 'mock',
        JWT_ACCESS_SECRET: 'e2e-only-secret-e2e-only-secret-e2e-only',
        AUTH_RATE_LIMIT_MAX: '200',
        RATE_LIMIT_MAX: '5000',
        CHAT_RATE_LIMIT_MAX: '500',
      },
    },
    {
      command: 'npm run dev -w @litsense/web',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
