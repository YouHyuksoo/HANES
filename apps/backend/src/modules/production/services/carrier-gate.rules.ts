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

/**
 * 키오스크 실적(ProdResultService.create)에서 대차 게이트를 걸어야 하는 공정인지.
 * 실적 저장 경로는 SG/BUNDLE 라벨만 발행(issueSgLabelInTx)하므로, ISSUE_LABEL_TYPE이 FG/NONE인 공정에
 * CARRIER_LOAD_YN='Y'가 켜져 있어도 담을 바코드가 없다 — 의미 없는 대차 스캔을 강요하지 않는다.
 * 조립 확정(confirmAssembly/confirmSubKit)은 FG 라벨을 직접 발행하므로 이 판정을 쓰지 않는다.
 */
export function isKioskCarrierGateApplicable(step: { issueLabelType?: string | null } | null): boolean {
  return step?.issueLabelType === 'SG' || step?.issueLabelType === 'BUNDLE';
}
