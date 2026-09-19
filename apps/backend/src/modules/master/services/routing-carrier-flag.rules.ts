/**
 * @file routing-carrier-flag.rules.ts
 * @description 라우팅 공정 대차 플래그 규칙 — 대차 적재(CARRIER_LOAD_YN)는 라벨이 발행되는 공정에서만 켤 수 있다.
 *              라벨이 없으면 대차에 담을 바코드가 없어 후공정 자동 투입이 성립하지 않는다(설계 3-3절).
 */
import { BadRequestException } from '@nestjs/common';

export const CARRIER_LOADABLE_LABEL_TYPES = ['BUNDLE', 'SG', 'FG'] as const;

export function assertCarrierLoadFlag(
  carrierLoadYn: string | undefined,
  issueLabelType: string | null | undefined,
): void {
  if (carrierLoadYn !== 'Y') return;
  if (!issueLabelType || !(CARRIER_LOADABLE_LABEL_TYPES as readonly string[]).includes(issueLabelType)) {
    throw new BadRequestException('대차 적재는 라벨 발행 공정(BUNDLE/SG/FG)에서만 켤 수 있습니다.');
  }
}
