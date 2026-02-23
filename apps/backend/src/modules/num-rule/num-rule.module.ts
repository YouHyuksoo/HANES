/**
 * @file src/modules/num-rule/num-rule.module.ts
 * @description 채번 모듈 — SELECT FOR UPDATE 기반 번호 생성 서비스 제공
 *
 * 초보자 가이드:
 * 1. NumRuleService를 export하여 다른 모듈에서 DI 가능
 * 2. 사용 시: imports에 NumRuleModule 추가 → constructor에서 NumRuleService 주입
 * 3. 예시: const arrivalNo = await this.numRuleService.nextNumberInTx(queryRunner, 'ARRIVAL');
 */

import { Module } from '@nestjs/common';
import { NumRuleService } from './num-rule.service';

@Module({
  providers: [NumRuleService],
  exports: [NumRuleService],
})
export class NumRuleModule {}
