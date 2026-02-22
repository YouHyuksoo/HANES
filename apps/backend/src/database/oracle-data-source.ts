/**
 * @file database/oracle-data-source.ts
 * @description Oracle Database DataSource for MYDBPDB
 * 
 * PostgreSQL(Prisma)와 함께 사용 - 듀얼 DB 설정
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Oracle MYDBPDB DataSource
export const OracleDataSource = new DataSource({
  type: 'oracle',
  host: process.env.ORACLE_HOST || 'localhost',
  port: parseInt(process.env.ORACLE_PORT || '1521', 10),
  username: process.env.ORACLE_USER || 'HNSMES',
  password: process.env.ORACLE_PASSWORD || 'your-oracle-password',
  serviceName: process.env.ORACLE_SERVICE_NAME || 'XEPDB',
  synchronize: false, // Oracle PK 충돌 방지 - 스키마 변경은 SQL로 직접 관리
  logging: process.env.NODE_ENV !== 'production' ? ['query', 'error'] : ['error'],
  logger: 'advanced-console',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/oracle/*{.ts,.js}'],
  migrationsRun: false,
  extra: {
    poolMax: 10,
    poolMin: 2,
    poolIncrement: 1,
    poolTimeout: 60,
    queueTimeout: 60000,
    stmtCacheSize: 30,
  },
  // Oracle 특화 설정
  metadataTableName: 'typeorm_metadata_oracle',
});

// Oracle 연결 테스트 함수
export async function testOracleConnection(): Promise<boolean> {
  try {
    await OracleDataSource.initialize();
    console.log('✅ Oracle MYDBPDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Oracle connection failed:', error);
    return false;
  }
}
