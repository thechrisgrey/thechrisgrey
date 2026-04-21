module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  globals: {
    awslambda: 'readonly',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['node_modules', 'function.zip', '__fixtures__'],
};
