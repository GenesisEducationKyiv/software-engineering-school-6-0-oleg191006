const { spawnSync } = require('child_process');

require('dotenv').config({ path: '.env.test' });
const fs = require('fs');
const path = require('path');

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

function createArchitectureTestHelpers({ root, fileLayerMap }) {
    function extractRequires(filePath) {
        const absolutePath = path.resolve(root, filePath);
        if (!fs.existsSync(absolutePath)) {
            return [];
        }

        const content = fs.readFileSync(absolutePath, 'utf8');
        const requires = [];

        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
            requires.push(match[1]);
        }

        return requires;
    }

    function resolveImportToFile(importPath, sourceFile) {
        if (importPath.startsWith('@/')) {
            return `src/${importPath.slice(2)}`;
        }

        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const sourceDir = path.dirname(sourceFile);
            return path.posix.normalize(
                path.posix.join(sourceDir.replace(/\\/g, '/'), importPath),
            );
        }

        return null;
    }

    function findMatchingLayerFile(resolvedPath) {
        if (!resolvedPath) {
            return null;
        }

        const normalized = resolvedPath.replace(/\\/g, '/');

        for (const pattern of Object.keys(fileLayerMap)) {
            if (
                normalized === pattern ||
                normalized === pattern.replace('.js', '') ||
                `${normalized}.js` === pattern ||
                `${normalized}/index.js` === pattern ||
                pattern.startsWith(`${normalized}/`)
            ) {
                return pattern;
            }
        }

        for (const pattern of Object.keys(fileLayerMap)) {
            if (pattern.includes(normalized) || normalized.includes(pattern.replace('.js', ''))) {
                return pattern;
            }
        }

        return null;
    }


    function getMappedDependencies(sourceFile) {
        const requires = extractRequires(sourceFile);
        const result = [];

        for (const req of requires) {
            const resolved = resolveImportToFile(req, sourceFile);
            const targetFile = findMatchingLayerFile(resolved);
            if (!targetFile) {
                continue;
            }
            result.push({
                import: req,
                resolvedTo: targetFile,
                targetLayer: fileLayerMap[targetFile],
            });
        }

        return result;
    }

    return {
        extractRequires,
        resolveImportToFile,
        findMatchingLayerFile,
        getMappedDependencies,
    };
}
module.exports = {
    runCommand,
    withCompose,
    resetCompose,
    buildTestEnv,
    createArchitectureTestHelpers,
};
