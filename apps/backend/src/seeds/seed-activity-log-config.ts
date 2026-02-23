/**
 * @file src/seeds/seed-activity-log-config.ts
 * @description 활동 로깅 시스템 설정(SYS_CONFIGS) 시드 스크립트
 *
 * 초보자 가이드:
 * 1. SYS_CONFIGS 테이블에 ENABLE_ACTIVITY_LOG 설정을 UPSERT
 * 2. 기본값은 'N' (비활성화) — 관리자가 시스템 설정 페이지에서 활성화
 * 3. seed-roles.ts와 동일한 Oracle DataSource 패턴 사용
 *
 * 실행 방법:
 *   cd apps/backend
 *   npx ts-node src/seeds/seed-activity-log-config.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function seedActivityLogConfig(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  HARNESS MES - Activity Log Config Seed');
  console.log('='.repeat(60));
  console.log();

  const dataSource = new DataSource({
    type: 'oracle',
    host: process.env.ORACLE_HOST || 'localhost',
    port: parseInt(process.env.ORACLE_PORT || '1521', 10),
    username: process.env.ORACLE_USER || 'HNSMES',
    password: process.env.ORACLE_PASSWORD || '',
    ...(process.env.ORACLE_SID
      ? { sid: process.env.ORACLE_SID }
      : { serviceName: process.env.ORACLE_SERVICE_NAME || 'JSHNSMES' }),
    synchronize: false,
    logging: false,
    entities: [],
  });

  try {
    console.log('  Connecting to Oracle...');
    await dataSource.initialize();
    console.log('  Connected successfully.\n');

    // UPSERT: configKey 기준 존재 여부 확인
    const existing = await dataSource.query(
      `SELECT "ID" FROM "SYS_CONFIGS" WHERE "CONFIG_KEY" = :1`,
      ['ENABLE_ACTIVITY_LOG'],
    );

    if (existing.length > 0) {
      console.log('  [SKIP] ENABLE_ACTIVITY_LOG - already exists');
    } else {
      await dataSource.query(
        `INSERT INTO "SYS_CONFIGS" (
          "ID", "CONFIG_GROUP", "CONFIG_KEY", "CONFIG_VALUE",
          "CONFIG_TYPE", "LABEL", "DESCRIPTION",
          "SORT_ORDER", "IS_ACTIVE", "CREATED_AT", "UPDATED_AT"
        ) VALUES (
          SYS_GUID(), 'SYSTEM', 'ENABLE_ACTIVITY_LOG', 'N',
          'BOOLEAN', '활동 로깅 활성화', '사용자 로그인 및 페이지 접속 기록을 저장합니다.',
          99, 'Y', SYSTIMESTAMP, SYSTIMESTAMP
        )`,
      );
      console.log('  [INSERT] ENABLE_ACTIVITY_LOG (default: N)');
    }

    console.log();
    console.log('  Seed completed successfully!');
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('\n  Seed failed:', error.message);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('  Connection closed.');
    }
  }
}

if (require.main === module) {
  seedActivityLogConfig();
}

export { seedActivityLogConfig };
