const { spawn } = require('child_process');
const { runCommand, resetCompose, withCompose, buildTestEnv } = require('./testUtils');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

async function waitForHealth(url, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${url}/health`);
            if (res.ok) {
                return;
            }
        } catch (_err) {
            // ignore and retry
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error('Server did not become healthy in time.');
}

function buildServerEnv() {
    return buildTestEnv({
        PORT: '3001',
        APP_URL: baseUrl,
    });
}

async function run() {
    let exitCode = 0;
    let server;

    try {
        resetCompose();

        server = spawn('node', ['-r', 'module-alias/register', 'src/server.js'], {
            stdio: 'inherit',
            env: buildServerEnv(),
        });

        await waitForHealth(baseUrl, 40000);

        runCommand('node', ['node_modules/playwright/cli.js', 'test'], {
            env: {
                ...process.env,
                PLAYWRIGHT_BASE_URL: baseUrl,
            },
        });
    } catch (err) {
        exitCode = 1;
        console.error(err.message);
    } finally {
        if (server) {
            server.kill('SIGTERM');
        }
        try {
            withCompose(['down', '-v', '--remove-orphans']);
        } catch (err) {
            console.error('Failed to stop docker compose:', err.message);
        }
    }

    process.exit(exitCode);
}

run();
