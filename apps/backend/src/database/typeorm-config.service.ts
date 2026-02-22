/**
 * @file database/typeorm-config.service.ts
 * @description TypeORM Configuration Service - 동적 설정 제공
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    
    return {
      type: 'oracle',
      host: this.configService.get<string>('ORACLE_HOST', 'localhost'),
      port: this.configService.get<number>('ORACLE_PORT', 1521),
      username: this.configService.get<string>('ORACLE_USER', 'MES_USER'),
      password: this.configService.get<string>('ORACLE_PASSWORD', 'password'),
      // SID 또는 ServiceName 중 하나 사용
      ...(this.configService.get<string>('ORACLE_SID') 
        ? { sid: this.configService.get<string>('ORACLE_SID') }
        : { serviceName: this.configService.get<string>('ORACLE_SERVICE_NAME', 'ORCL') }
      ),
      entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
      synchronize: false, // Oracle PK 충돌 방지 - 스키마 변경은 SQL로 직접 관리
      logging: !isProduction ? ['query', 'error'] : ['error'],
      logger: 'advanced-console',
      maxQueryExecutionTime: 1000,
      extra: {
        poolMax: 10,
        poolMin: 2,
        poolIncrement: 1,
        poolTimeout: 60,
        queueTimeout: 60000,
        stmtCacheSize: 30,
      },
      // Oracle 특화 설정
      metadataTableName: 'typeorm_metadata',
    };
  }
}
