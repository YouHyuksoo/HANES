/**
 * @file database/data-source.ts
 * @description TypeORM DataSource 설정 - Oracle DB 연결
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'oracle',
  host: process.env.ORACLE_HOST || 'localhost',
  port: parseInt(process.env.ORACLE_PORT || '1521', 10),
  username: process.env.ORACLE_USER || 'MES_USER',
  password: process.env.ORACLE_PASSWORD || 'password',
  sid: process.env.ORACLE_SID || 'ORCL',
  synchronize: process.env.NODE_ENV !== 'production', // 개발 환경에서만 자동 동기화
  logging: process.env.NODE_ENV !== 'production',
  logger: 'advanced-console',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: false,
  extra: {
    poolMax: 10,
    poolMin: 2,
    poolIncrement: 1,
    poolTimeout: 60,
    queueTimeout: 60000,
  },
});

// Oracle 특화 설정
export const oracleConfig = {
  // 대소문자 구분 설정 (Oracle은 기본적으로 대문자)
  caseSensitive: false,
  // 스키마 이름
  schema: process.env.ORACLE_USER || 'MES_USER',
};
