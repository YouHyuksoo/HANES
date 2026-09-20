/**
 * @file database/database.module.ts
 * @description Main Database Module - Oracle as Primary (자동 재연결 지원)
 *
 * 접속 값은 database/oracle-env.ts 를 통해 apps/backend/.env 에서만 읽는다.
 *
 * 초보자 가이드:
 * 1. **retryAttempts**: 초기 연결 실패 시 재시도 횟수
 * 2. **poolPingInterval**: 풀 커넥션 유효성 검사 주기(초) — 끊긴 연결 자동 감지
 * 3. **connectTimeout**: 개별 연결 시 타임아웃(초) — 네트워크 지연 대응
 * 4. **expireTime**: 유휴 커넥션 만료 시간(초) — 오래된 연결 자동 정리
 */

import { Module, Global, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SqlDebugTypeormLogger } from '../common/sql-debug/typeorm-sql-debug.logger';
import { describeOracleTarget, oracleTypeOrmConnection, oraclePoolExtra } from './oracle-env';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const read = (key: string) => configService.get<string>(key);

        logger.log(`Oracle DB 연결: ${describeOracleTarget(read)}`);

        return {
          type: 'oracle',
          ...oracleTypeOrmConnection(read),
          synchronize: false,
          logging: ['query', 'error', 'warn'],
          logger: new SqlDebugTypeormLogger(),
          maxQueryExecutionTime: 3000,
          entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: false,

          // 초기 연결 재시도 — 서버 시작 시 DB가 아직 안 올라온 경우 대응
          retryAttempts: 15,
          retryDelay: 5000,

          // oracledb 연결 풀 옵션 — DB 끊김 후 자동 복구. 값·근거는 oracle-env.ts oraclePoolExtra 단일 출처
          extra: oraclePoolExtra(read),
          metadataTableName: 'typeorm_metadata',
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
