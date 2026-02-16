/**
 * @file database/test-connection.ts
 * @description Oracle Database Connection Test Script
 * 
 * 사용법:
 * npx ts-node src/database/test-connection.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const ora = require('oracledb');

// Oracle Thick Mode 활성화 (선택사항)
// ora.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

interface ConnectionConfig {
  type: 'oracle';
  host: string;
  port: number;
  username: string;
  password: string;
  sid?: string;
  serviceName?: string;
}

function getConfig(): ConnectionConfig {
  const config: ConnectionConfig = {
    type: 'oracle',
    host: process.env.ORACLE_HOST || 'localhost',
    port: parseInt(process.env.ORACLE_PORT || '1521', 10),
    username: process.env.ORACLE_USER || 'MES_USER',
    password: process.env.ORACLE_PASSWORD || '',
  };

  const sid = process.env.ORACLE_SID;
  const serviceName = process.env.ORACLE_SERVICE_NAME;

  if (sid) {
    config.sid = sid;
  } else if (serviceName) {
    config.serviceName = serviceName;
  } else {
    config.sid = 'ORCL';
  }

  return config;
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

  // 필수 환경 변수 확인
  if (!config.password) {
    console.error('❌ Error: ORACLE_PASSWORD environment variable is required');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'oracle',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    ...(config.sid ? { sid: config.sid } : { serviceName: config.serviceName }),
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

  } catch (error: any) {
    console.error('❌ Connection failed!\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    if (error.message.includes('ORA-12541')) {
      console.error('\n💡 Hint: Oracle listener is not running or cannot be reached.');
    } else if (error.message.includes('ORA-12514')) {
      console.error('\n💡 Hint: Service name or SID is incorrect.');
    } else if (error.message.includes('ORA-01017')) {
      console.error('\n💡 Hint: Invalid username or password.');
    } else if (error.message.includes('ORA-12154')) {
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
