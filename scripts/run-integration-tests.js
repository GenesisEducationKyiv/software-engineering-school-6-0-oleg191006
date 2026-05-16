const { runCommand, resetCompose, withCompose, buildTestEnv } = require('./testUtils');

async function run() {
    let exitCode = 0;

    try {
        resetCompose();

        const env = buildTestEnv({
            APP_URL: 'http://localhost:3000',
        });
        runCommand('node', [
            'node_modules/jest/bin/jest.js',
            '--runInBand',
            '--testPathPattern=tests/integration',
            '--passWithNoTests',
        ], { env });
    } catch (err) {
        exitCode = 1;
        console.error(err.message);
    } finally {
        try {
            withCompose(['down', '-v', '--remove-orphans']);
        } catch (err) {
            console.error('Failed to stop docker compose:', err.message);
        }
    }

    process.exit(exitCode);
}

run();
