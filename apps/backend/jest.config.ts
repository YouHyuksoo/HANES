/**
 * @file jest.config.ts
 * @description Jest 테스트 설정 - NestJS + TypeORM + Oracle 백엔드
 *
 * 초보자 가이드:
 * 1. `pnpm test` → 전체 테스트 실행
 * 2. `pnpm test -- --watch` → 파일 변경 시 자동 실행
 * 3. `pnpm test -- -t "test name"` → 특정 테스트만 실행
 * 4. `pnpm test:cov` → 커버리지 리포트 생성
 */
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.service.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',

  /** tsconfig path alias 매핑 */
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
  },
};

export default config;
