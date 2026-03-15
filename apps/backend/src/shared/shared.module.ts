/**
 * @file shared.module.ts
 * @description 전역 공유 모듈 — 모든 모듈에서 사용 가능한 공통 서비스 제공
 *
 * 초보자 가이드:
 * 1. @Global() 데코레이터로 전역 모듈 등록
 * 2. AppModule에 한 번만 import하면 어디서든 주입 가능
 * 3. UidGeneratorService: matUid/prdUid 채번 (레거시, 점진적 제거 예정)
 * 4. SeqGeneratorService: 통합 채번 (PKG_SEQ_GENERATOR 호출)
 */
import { Module, Global } from '@nestjs/common';
import { UidGeneratorService } from './uid-generator.service';
import { SeqGeneratorService } from './seq-generator.service';

@Global()
@Module({
  providers: [UidGeneratorService, SeqGeneratorService],
  exports: [UidGeneratorService, SeqGeneratorService],
})
export class SharedModule {}
