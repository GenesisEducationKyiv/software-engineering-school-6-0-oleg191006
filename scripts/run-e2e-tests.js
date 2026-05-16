const { spawn, spawnSync } = require('child_process');
const http = require('http');

const composeFile = 'docker-compose.test.yml';
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

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

function waitForHealth(url, timeoutMs = 30000) {
    const start = Date.now();

    return new Promise((resolve, reject) => {
        const attempt = () => {
            http.get(`${url}/health`, (res) => {
                res.resume();
                if (res.statusCode === 200) {
                    resolve();
                    return;
                }
                retry();
            }).on('error', retry);
        };

        const retry = () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error('Server did not become healthy in time.'));
                return;
            }
            setTimeout(attempt, 500);
        };

        attempt();
    });
}

function buildServerEnv() {
    return {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3001',
        APP_URL: baseUrl,
        DB_HOST: 'localhost',
        DB_PORT: '5433',
        DB_NAME: 'notificator_test',
        DB_USER: 'postgres',
        DB_PASSWORD: 'postgres',
        REDIS_URL: 'redis://localhost:6380',
        REDIS_CONNECT_TIMEOUT_MS: '5000',
        API_KEY: '',
        GITHUB_TOKEN: '',
        RESEND_API_KEY: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        SCAN_CRON: '0 0 1 1 *',
    };
}

async function run() {
    let exitCode = 0;
    let server;

    try {
        withCompose(['down', '-v', '--remove-orphans']);
        withCompose(['up', '-d', '--wait']);

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
