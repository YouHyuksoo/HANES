/**
 * @file shared.module.ts
 * @description 전역 공유 모듈 — 모든 모듈에서 사용 가능한 공통 서비스 제공
 *
 * 초보자 가이드:
 * 1. @Global() 데코레이터로 전역 모듈 등록
 * 2. AppModule에 한 번만 import하면 어디서든 주입 가능
 * 3. NumberingService: 통합 채번 파사드 (신규 코드에서 사용 권장)
 * 4. SeqGeneratorService: PKG_SEQ_GENERATOR 호출 (하위호환)
 * 5. NumRuleService: NUM_RULE_MASTERS 기반 채번 (하위호환)
 */
import { Module, Global } from '@nestjs/common';
import { SeqGeneratorService } from './seq-generator.service';
import { NumberingService } from './numbering.service';
import { TransactionService } from './transaction.service';
import { NumRuleService } from '../modules/num-rule/num-rule.service';

@Global()
@Module({
  providers: [SeqGeneratorService, NumRuleService, NumberingService, TransactionService],
  exports: [SeqGeneratorService, NumRuleService, NumberingService, TransactionService],
})
export class SharedModule {}
