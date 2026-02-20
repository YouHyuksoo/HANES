/**
 * @file database/database.module.ts
 * @description Main Database Module - Oracle as Primary
 * 
 * 메인 DB: Oracle (MYDBPDB)
 * 레거시: PostgreSQL (Prisma) - 참조용으로 유지
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    // Main Database: Oracle MYDBPDB
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'oracle',
        host: configService.get<string>('ORACLE_HOST', 'localhost'),
        port: configService.get<number>('ORACLE_PORT', 1521),
        username: configService.get<string>('ORACLE_USER', 'HNSMES'),
        password: configService.get<string>('ORACLE_PASSWORD', 'your-oracle-password'),
        ...(configService.get<string>('ORACLE_SID')
          ? { sid: configService.get<string>('ORACLE_SID') }
          : { serviceName: configService.get<string>('ORACLE_SERVICE_NAME', 'JSHNSMES') }),
        synchronize: false,
        logging: true,
        logger: 'advanced-console',
        maxQueryExecutionTime: 1000,
        entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: false,
        retryAttempts: 10,
        retryDelay: 3000,
        extra: {
          poolMax: 10,
          poolMin: 2,
          poolIncrement: 1,
          poolTimeout: 60,
          queueTimeout: 60000,
          stmtCacheSize: 30,
          expireTime: 60,
          poolPingInterval: 30,
        },
        metadataTableName: 'typeorm_metadata',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
