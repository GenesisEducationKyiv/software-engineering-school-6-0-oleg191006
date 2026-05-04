const js = require('@eslint/js');
const jest = require('eslint-plugin-jest');
const globals = require('globals');

const ignoreConfig = {
    ignores: ['coverage/**'],
};

const mainConfig = {
    files: ['**/*.js'],
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
        globals: {
            ...globals.node,
        },
    },
    linterOptions: {
        reportUnusedDisableDirectives: true,
    },
    rules: {
        //variable declaration
        'no-unused-vars': ['warn', {
            argsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
        }],
        'no-var': 'error',
        'prefer-const': 'error',
        'no-shadow': 'warn',

        //code quality
        'eqeqeq': ['error', 'always'],
        'no-else-return': 'error',
        'array-callback-return': 'error',
        'no-duplicate-imports': 'error',
        'no-template-curly-in-string': 'warn',

        //modern syntax
        'object-shorthand': ['error', 'always'],
        'prefer-template': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-destructuring': ['warn', { array: false, object: true }],

        // formatting
        'curly': ['error', 'all'],
        'semi': ['error', 'always'],
        'quotes': ['error', 'single', { avoidEscape: true }],
        'indent': ['error', 4],
        'comma-dangle': ['error', 'always-multiline'],

        'no-console': 'off',
    },
};

const testConfig = {
    files: ['tests/**/*.js', '**/*.test.js'],
    plugins: {
        jest,
    },
    languageOptions: {
        globals: {
            ...globals.jest,
        },
    },
    rules: {
        ...jest.configs['flat/recommended'].rules,
        ...jest.configs['flat/style'].rules,
        'jest/expect-expect': 'off',
    },
};

module.exports = [
    ignoreConfig,
    js.configs.recommended,
    mainConfig,
    testConfig,
];