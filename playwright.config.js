const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'tests/e2e',
    timeout: 30000,
    expect: {
        timeout: 5000,
    },
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
        trace: 'retain-on-failure',
    },
    reporter: [['list']],
});
