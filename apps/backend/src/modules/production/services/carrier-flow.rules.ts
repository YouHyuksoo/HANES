/**
 * @file carrier-flow.rules.ts
 * @description 대차 흐름 순수 규칙 — 상태 도출, 적재 가능 판정, 자동투입 가능 판정. DB를 모른다.
 *
 * 초보자 가이드:
 * 1. 대차의 진실은 SG_LABELS/FG_LABELS/MAT_LOTS.CARRIER_NO다. 이 파일은 그 행들의 배열(CarrierContentRow[])만 받는다.
 * 2. 생산 대차(SG/FG)는 품목 하나·작업지시 하나·전표 발행 후 잠금·자동투입은 전표 필수.
 *    원자재 대차(MAT)는 키팅이라 품목 혼적 허용, 전표 없이도 자동 장착 허용(설계 12절, 강제하지 않는다).
 * 3. 라벨과 원자재는 한 대차에 섞지 않는다.
 */
import { BadRequestException } from '@nestjs/common';

export type CarrierContentKind = 'SG' | 'FG' | 'MAT';
export type CarrierStatus = 'EMPTY' | 'LOADING' | 'IN_TRANSIT';

export interface CarrierContentRow {
  kind: CarrierContentKind;
  barcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  qty: number;
  loadedAt: Date | null;
  slipNo: string | null;
  issueProcessCode: string | null;
}

export function deriveCarrierStatus(rows: CarrierContentRow[]): CarrierStatus {
  if (rows.length === 0) return 'EMPTY';
  return rows.some((r) => r.slipNo) ? 'IN_TRANSIT' : 'LOADING';
}

/** 담긴 내용의 종류. 라벨(SG/FG)은 생산 대차로 묶고 MAT는 원자재 대차 */
export function carrierKindOf(rows: CarrierContentRow[]): CarrierContentKind | null {
  return rows[0]?.kind ?? null;
}

export function isProductionKind(kind: CarrierContentKind | null): boolean {
  return kind === 'SG' || kind === 'FG';
}

export function assertCanLoad(input: {
  rows: CarrierContentRow[];
  kind: CarrierContentKind;
  itemCode: string;
  orderNo: string | null;
  addCount: number;
  capacity: number | null;
}): void {
  const { rows, kind, itemCode, orderNo, addCount, capacity } = input;
  if (deriveCarrierStatus(rows) === 'IN_TRANSIT') {
    throw new BadRequestException('이동전표가 발행된 대차입니다. 비워진 뒤에 다시 쓰세요.');
  }
  const existingKind = carrierKindOf(rows);
  if (existingKind && isProductionKind(existingKind) !== isProductionKind(kind)) {
    throw new BadRequestException('라벨과 원자재를 한 대차에 섞을 수 없습니다.');
  }
  if (isProductionKind(kind) && rows.length > 0) {
    const head = rows[0];
    if (head.itemCode !== itemCode) {
      throw new BadRequestException(`대차에 다른 품목이 담겨 있습니다: ${head.itemCode}`);
    }
    if ((head.orderNo ?? null) !== (orderNo ?? null)) {
      throw new BadRequestException(`대차에 다른 작업지시분이 담겨 있습니다: ${head.orderNo ?? '-'}`);
    }
  }
  if (capacity != null && rows.length + addCount > capacity) {
    throw new BadRequestException(`대차 교체: 수용량 ${capacity}을(를) 초과합니다 (현재 ${rows.length}, 추가 ${addCount}).`);
  }
}

export function assertCanAutoInput(input: { rows: CarrierContentRow[]; autoInputYn: string }): void {
  const { rows, autoInputYn } = input;
  if (autoInputYn !== 'Y') {
    throw new BadRequestException('이 공정은 대차 자동투입을 쓰지 않습니다.');
  }
  if (rows.length === 0) {
    throw new BadRequestException('빈 대차입니다.');
  }
  if (isProductionKind(carrierKindOf(rows)) && !rows.some((r) => r.slipNo)) {
    throw new BadRequestException('이동전표 미발행 대차입니다. 이전 공정에서 이동전표를 발행하세요.');
  }
}
