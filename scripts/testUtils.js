const { spawnSync } = require('child_process');

require('dotenv').config({ path: '.env.test' });

const composeFile = 'docker-compose.test.yml';

function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: 'inherit', ...options });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
    }
}

function withCompose(commandArgs) {
    runCommand('docker', ['compose', '-f', composeFile, ...commandArgs]);
}

function resetCompose() {
    withCompose(['down', '-v', '--remove-orphans']);
    withCompose(['up', '-d', '--wait']);
}

function buildBaseTestEnv() {
    return {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'test',
        DB_HOST: process.env.DB_HOST || 'localhost',
        DB_PORT: process.env.DB_PORT || '5433',
        DB_NAME: process.env.DB_NAME || 'notificator_test',
        DB_USER: process.env.DB_USER || 'postgres',
        DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
        REDIS_CONNECT_TIMEOUT_MS: process.env.REDIS_CONNECT_TIMEOUT_MS || '5000',
        API_KEY: process.env.API_KEY || '',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        SMTP_USER: process.env.SMTP_USER || '',
        SMTP_PASS: process.env.SMTP_PASS || '',
        SCAN_CRON: process.env.SCAN_CRON || '0 0 1 1 *',
    };
}

function buildTestEnv(overrides = {}) {
    return {
        ...buildBaseTestEnv(),
        ...overrides,
    };
}

module.exports = {
    runCommand,
    withCompose,
    resetCompose,
    buildTestEnv,
};
