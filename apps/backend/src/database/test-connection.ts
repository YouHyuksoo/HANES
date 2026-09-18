/**
 * @file database/test-connection.ts
 * @description Oracle Database Connection Test Script
 * 
 * 사용법:
 * npx ts-node src/database/test-connection.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { OracleEnv, oracleTypeOrmConnection, readOracleEnv } from './oracle-env';

// 환경 변수 로드
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Oracle Thick Mode 활성화 (선택사항)
// require('oracledb').initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

function getConfig(): OracleEnv {
  return readOracleEnv();
}

async function testOracleConnection() {
  console.log('🔌 Oracle Database Connection Test\n');
  console.log('=====================================\n');

  const config = getConfig();

  // 설정 정보 출력 (비밀번호 제외)
  console.log('📋 Connection Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Username: ${config.username}`);
  console.log(`   ${config.sid ? `SID: ${config.sid}` : `Service Name: ${config.serviceName}`}`);
  console.log();

  const dataSource = new DataSource({
    type: 'oracle',
    ...oracleTypeOrmConnection(),
    synchronize: false,
    logging: true,
    entities: [],
  });

  try {
    console.log('⏳ Connecting to Oracle database...\n');
    
    await dataSource.initialize();
    
    console.log('✅ Successfully connected to Oracle database!\n');

    // 기본 쿼리 테스트
    console.log('📝 Running test query...\n');
    const result = await dataSource.query('SELECT SYSDATE AS CURRENT_DATE FROM DUAL');
    console.log('✅ Test query result:', result);
    console.log();

    // 데이터베이스 버전 확인
    console.log('📊 Checking database version...\n');
    const versionResult = await dataSource.query(`
      SELECT 
        BANNER AS VERSION,
        BANNER_FULL AS FULL_VERSION
      FROM V$VERSION 
      WHERE ROWNUM = 1
    `);
    console.log('Oracle Version:', versionResult[0]?.VERSION || 'Unknown');
    console.log();

    // 현재 사용자 확인
    console.log('👤 Checking current user...\n');
    const userResult = await dataSource.query('SELECT USER AS CURRENT_USER FROM DUAL');
    console.log('Current User:', userResult[0]?.CURRENT_USER);
    console.log();

    // 테이블 존재 여부 확인
    console.log('📋 Checking existing tables...\n');
    const tablesResult = await dataSource.query(`
      SELECT TABLE_NAME 
      FROM USER_TABLES 
      ORDER BY TABLE_NAME
    `);
    
    if (tablesResult.length === 0) {
      console.log('   No tables found in the current schema.');
    } else {
      console.log(`   Found ${tablesResult.length} tables:`);
      tablesResult.forEach((row: any, index: number) => {
        console.log(`   ${index + 1}. ${row.TABLE_NAME}`);
      });
    }
    console.log();

    console.log('=====================================');
    console.log('✅ All connection tests passed!');
    console.log('=====================================\n');

    await dataSource.destroy();
    process.exit(0);

  } catch (error: unknown) {
    // oracledb 오류는 Error에 code를 얹어 던진다 — 둘 다 없을 수 있으므로 좁혀서 읽는다.
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    console.error('❌ Connection failed!\n');
    console.error('Error Details:');
    console.error(`   Message: ${message}`);
    console.error(`   Code: ${code || 'N/A'}`);
    
    if (message.includes('ORA-12541')) {
      console.error('\n💡 Hint: Oracle listener is not running or cannot be reached.');
    } else if (message.includes('ORA-12514')) {
      console.error('\n💡 Hint: Service name or SID is incorrect.');
    } else if (message.includes('ORA-01017')) {
      console.error('\n💡 Hint: Invalid username or password.');
    } else if (message.includes('ORA-12154')) {
      console.error('\n💡 Hint: TNS connection identifier could not be resolved.');
    }

    console.log('\n=====================================');
    console.log('❌ Connection test failed!');
    console.log('=====================================\n');

    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

// 직접 실행 시 테스트 수행
if (require.main === module) {
  testOracleConnection();
}

export { testOracleConnection, getConfig };
