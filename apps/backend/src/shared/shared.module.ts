/**
 * @file shared.module.ts
 * @description 전역 공유 모듈 — 모든 모듈에서 사용 가능한 공통 서비스 제공
 *
 * 초보자 가이드:
 * 1. @Global() 데코레이터로 전역 모듈 등록
 * 2. AppModule에 한 번만 import하면 어디서든 주입 가능
 * 3. UidGeneratorService: matUid/prdUid 채번
 */
import { Module, Global } from '@nestjs/common';
import { UidGeneratorService } from './uid-generator.service';

@Global()
@Module({
  providers: [UidGeneratorService],
  exports: [UidGeneratorService],
})
export class SharedModule {}
