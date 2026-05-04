const js = require('@eslint/js');
const jest = require('eslint-plugin-jest');
const globals = require('globals');

module.exports = [
    {
        ignores: ['coverage/**'],
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            jest,
        },
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'no-duplicate-imports': 'error',
            'no-template-curly-in-string': 'warn',
            'array-callback-return': 'error',
            'object-shorthand': ['error', 'always'],
            'prefer-template': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-destructuring': ['warn', { array: false, object: true }],
            'no-else-return': 'error',
            'no-console': 'off',
            'no-shadow': 'warn',
            'curly': ['error', 'all'],
            'semi': ['error', 'always'],
            'quotes': [
                'error',
                'single',
                {
                    avoidEscape: true,
                },
            ],
            'indent': ['error', 4],
            'comma-dangle': ['error', 'always-multiline'],
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'jest/expect-expect': 'off',
        },
    },
    {
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
    },
];
