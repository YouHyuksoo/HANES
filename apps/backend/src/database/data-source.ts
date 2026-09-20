/**
 * @file database/data-source.ts
 * @description TypeORM CLI용 DataSource (db:migrate:run / db:migrate:revert)
 *
 * 접속 환경변수는 apps/backend/.env(.env.local 우선)가 단일 출처이며,
 * 런타임 연결(database.module.ts)과 동일한 oracle-env 헬퍼를 사용한다.
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { oracleTypeOrmConnection, oraclePoolExtra } from './oracle-env';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// dotenv 로드 이후에 읽어야 하므로 import 순서가 아닌 호출 시점이 중요하다.

export const AppDataSource = new DataSource({
  type: 'oracle',
  ...oracleTypeOrmConnection(),
  synchronize: false, // Oracle PK 충돌 방지 - 스키마 변경은 SQL로 직접 관리
  logging: process.env.NODE_ENV !== 'production',
  logger: 'advanced-console',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: false,
  // 풀 옵션은 런타임과 같은 단일 출처(oracle-env.ts). CLI 는 마이그레이션이 길어 queueTimeout 만 넉넉히 둔다
  extra: { ...oraclePoolExtra(), queueTimeout: 60000 },
});
