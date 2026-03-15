/**
 * @file apps/backend/src/common/modules/oracle.module.ts
 * @description OracleService를 글로벌로 제공하는 모듈
 *
 * 초보자 가이드:
 * 1. AppModule에 한 번만 import하면 모든 모듈에서 OracleService 사용 가능
 * 2. ConfigModule이 먼저 로드되어야 환경변수를 읽을 수 있음
 */

import { Global, Module } from '@nestjs/common';
import { OracleService } from '../services/oracle.service';

@Global()
@Module({
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
