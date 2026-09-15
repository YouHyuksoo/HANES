/**
 * @file packages/shared/src/utils/issue-allocation-rules.ts
 * @description 자재출고 FIFO 배분 규칙 — 요청 수량을 선입선출 순서의 롯트에 나눠 배정한다.
 *
 * 단일 출처인 이유: 출고 모달의 자동배분, 분할 대상 판정(부분 사용 롯트만 분할),
 * 부족 수량 표시가 모두 같은 계산을 봐야 한다.
 *
 * 여기서 "배분"은 수량 계산일 뿐이며 실물 LOT 분할(신규 시리얼 발번)이 아니다.
 */

/** FIFO 배분 입력 롯트. 배열 순서가 곧 선입선출 순서다(호출부가 입고일 오름차순으로 넘긴다). */
export interface FifoLot {
  matUid: string;
  /** 출고 가능 수량(예약 제외) */
  availableQty: number;
}

/** 롯트 하나에 배정된 수량 */
export interface AllocationSlice {
  matUid: string;
  qty: number;
}

export interface AllocationResult {
  /** qty > 0 인 조각만 담긴다 — 백엔드 DTO 가 issueQty 를 @Min(1) 로 검증하기 때문 */
  slices: AllocationSlice[];
  allocatedQty: number;
  /** 가용 재고로 채우지 못한 수량 */
  shortageQty: number;
}

/**
 * 실출고수량 = 포장단위 배수로 올린 수량.
 * 포장단위(MIN_PACK_QTY)가 0 이하이거나 수량이 0 이하이면 원값을 그대로 돌려준다.
 */
export function roundUpToPack(qty: number, minPackQty: number): number {
  return minPackQty > 0 && qty > 0 ? Math.ceil(qty / minPackQty) * minPackQty : qty;
}

/**
 * 총 출고수량을 FIFO(입고일 오름차순) 롯트에 앞에서부터 채운다.
 *
 * - 각 롯트에서 min(남은 총량, availableQty) 만큼 가져간다.
 * - 가용 0 인 롯트와 결과적으로 0 이 되는 조각은 반환하지 않는다.
 * - 전 롯트로도 못 채우면 shortageQty 로 알린다(차단하지 않는다 — 부분출고 허용).
 */
export function allocateFifo(totalQty: number, lots: ReadonlyArray<FifoLot>): AllocationResult {
  if (!(totalQty > 0)) {
    return { slices: [], allocatedQty: 0, shortageQty: 0 };
  }

  const slices: AllocationSlice[] = [];
  let remaining = totalQty;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = lot.availableQty > 0 ? lot.availableQty : 0;
    if (available <= 0) continue;

    const qty = Math.min(remaining, available);
    slices.push({ matUid: lot.matUid, qty });
    remaining -= qty;
  }

  const allocatedQty = totalQty - remaining;
  return { slices, allocatedQty, shortageQty: remaining };
}
