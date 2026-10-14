import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', workers: 1, fullyParallel: false,
  timeout: 30_000, reporter: 'list', outputDir: 'test-results',
});
