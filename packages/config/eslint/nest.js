/**
 * @file packages/config/eslint/nest.js
 * @description ESLint NestJS 설정
 */

const baseConfig = require('./base');

module.exports = {
  ...baseConfig,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    ...baseConfig.rules,
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
