import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
// Default: the in-process mock. E2E_MODEL_SERVICE_MODE=http runs the same smoke test against a real
// model service (E2E_MODEL_SERVICE_URL plus E2E_MODEL_SERVICE_KEY, the service's SERVICE_API_KEY).
const LIVE = process.env.E2E_MODEL_SERVICE_MODE === 'http';
const model: Record<string, string> = LIVE
  ? {
      MODEL_SERVICE_MODE: 'http',
      MODEL_SERVICE_URL: required('E2E_MODEL_SERVICE_URL'),
      MODEL_SERVICE_KEY: required('E2E_MODEL_SERVICE_KEY'),
    }
  : { MODEL_SERVICE_MODE: 'mock' };
// The smoke test needs a MongoDB (docker compose up mongo, or the CI service container). Live runs
// use their own database: the catalogue is seeded from the service and its book ids differ.
const mongo =
  process.env.E2E_MONGODB_URI ?? `mongodb://127.0.0.1:27017/${LIVE ? 'litsense_e2e_live' : 'litsense_e2e'}`;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when E2E_MODEL_SERVICE_MODE=http`);
  return value;
}

export default defineConfig({
  testDir: 'e2e',
  // Live runs wait on the service's language model (chat, explanations), so allow for it.
  timeout: LIVE ? 240_000 : 60_000,
  expect: { timeout: LIVE ? 45_000 : 10_000 },
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
      // /readyz is 503 until the catalogue is seeded (a live run waits for the service to load first).
      url: 'http://localhost:4000/readyz',
      reuseExistingServer: !CI,
      timeout: LIVE ? 600_000 : 120_000,
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'warn',
        PORT: '4000',
        MONGODB_URI: mongo,
        REDIS_URL: '',
        ...model,
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
