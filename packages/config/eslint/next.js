/**
 * @file packages/config/eslint/next.js
 * @description ESLint Next.js 설정
 */

const baseConfig = require('./base');

module.exports = {
  ...baseConfig,
  extends: [
    ...baseConfig.extends,
    'next/core-web-vitals',
  ],
  rules: {
    ...baseConfig.rules,
    '@next/next/no-html-link-for-pages': 'off',
    'react/display-name': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
