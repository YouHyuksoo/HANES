/**
 * @file database/database.module.ts
 * @description Main Database Module - Oracle as Primary (자동 재연결 지원)
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

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const host = configService.get<string>('ORACLE_HOST', 'localhost');
        const port = configService.get<number>('ORACLE_PORT', 1521);

        logger.log(`Oracle DB 연결: ${host}:${port}`);

        return {
          type: 'oracle',
          host,
          port,
          username: configService.get<string>('ORACLE_USER', 'HNSMES'),
          password: configService.get<string>('ORACLE_PASSWORD', 'your-oracle-password'),
          ...(configService.get<string>('ORACLE_SID')
            ? { sid: configService.get<string>('ORACLE_SID') }
            : { serviceName: configService.get<string>('ORACLE_SERVICE_NAME', 'JSHNSMES') }),
          synchronize: false,
          logging: configService.get<string>('NODE_ENV') !== 'production',
          logger: 'advanced-console',
          maxQueryExecutionTime: 3000,
          entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: false,

          // 초기 연결 재시도 — 서버 시작 시 DB가 아직 안 올라온 경우 대응
          retryAttempts: 15,
          retryDelay: 5000,

          // oracledb 연결 풀 옵션 — DB 끊김 후 자동 복구 핵심 설정
          extra: {
            poolMax: 10,
            poolMin: 2,
            poolIncrement: 1,
            poolTimeout: 60,          // 유휴 커넥션 대기 시간(초)
            queueTimeout: 30000,      // 풀 가득 찼을 때 대기 시간(ms)
            stmtCacheSize: 30,
            connectTimeout: 10,       // 개별 연결 타임아웃(초) — 네트워크 끊김 빠른 감지
            expireTime: 30,           // 유휴 커넥션 만료(초) — 끊긴 연결 자동 정리
            poolPingInterval: 10,     // 사용 전 커넥션 핑 검사 주기(초) — 죽은 연결 감지
          },
          metadataTableName: 'typeorm_metadata',
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
