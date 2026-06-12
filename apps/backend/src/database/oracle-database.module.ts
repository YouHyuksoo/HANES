/**
 * @file database/oracle-database.module.ts
 * @description Oracle Database Module for MYDBPDB
 * 
 * Oracle 단일 DB 설정
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'oracle', // 연결 이름 지정
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'oracle',
        host: configService.get<string>('ORACLE_HOST', 'localhost'),
        port: configService.get<number>('ORACLE_PORT', 1521),
        username: configService.get<string>('ORACLE_USER', 'HNSMES'),
        password: configService.get<string>('ORACLE_PASSWORD', 'your-oracle-password'),
        serviceName: configService.get<string>('ORACLE_SERVICE_NAME', 'XEPDB'),
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') !== 'production' ? ['query', 'error'] : ['error'],
        logger: 'advanced-console',
        entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/oracle/*{.ts,.js}'],
        migrationsRun: false,
        extra: {
          poolMax: 20,
          poolMin: 4,
          poolIncrement: 2,
          poolTimeout: 60,
          queueTimeout: 60000,
        },
        metadataTableName: 'typeorm_metadata_oracle',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class OracleDatabaseModule {}
