/**
 * @file carrier-gate.rules.ts
 * @description 실적 저장 대차 게이트 — 라우팅 공정 CARRIER_LOAD_YN='Y'면 출력 대차 없이 저장할 수 없다(설계 2절 "미스캔=차단").
 */
import { BadRequestException } from '@nestjs/common';

export function assertCarrierGate(step: { carrierLoadYn?: string | null } | null, carrierNo: string | undefined): void {
  if (step?.carrierLoadYn !== 'Y') return;
  if (!carrierNo || !carrierNo.trim()) {
    throw new BadRequestException('출력 대차를 스캔하세요. 이 공정은 실적 라벨을 대차에 담아야 합니다.');
  }
}
