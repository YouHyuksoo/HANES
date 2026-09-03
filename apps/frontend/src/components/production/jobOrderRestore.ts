/**
 * @file src/components/production/jobOrderRestore.ts
 * @description 설비에 저장된 작업지시를 키오스크류 화면(생산실적/조립/서브공정)이 복원할 때의 공통 판정.
 *
 * 초보자 가이드:
 * - 설비(EQUIP_MASTERS.CURRENT_JOB_ORDER_ID)에 남은 지시가 완료/취소됐거나 아예 없으면
 *   복원하지 않고 설비 바인딩을 풀어 작업자가 새 지시를 고르게 한다.
 * - 판정 규칙(isJobOrderFinished)은 @harness/shared — 백엔드 complete/cancel 도 같은 규칙으로 바인딩을 해제한다.
 */
import { isJobOrderFinished } from "@harness/shared";
import api from "@/services/api";

export type RestoreVerdict =
  | { kind: "ok" }
  /** 완료/취소된 지시 — 바인딩 해제 후 새로 선택 안내 */
  | { kind: "finished"; status: string }
  /** 지시를 찾을 수 없음(삭제/오래된 데이터) — 바인딩 해제 */
  | { kind: "missing" };

export function judgeRestoredJobOrder(order: { orderNo?: string | null; status?: string | null } | null | undefined): RestoreVerdict {
  if (!order?.orderNo) return { kind: "missing" };
  if (isJobOrderFinished(order.status)) return { kind: "finished", status: String(order.status) };
  return { kind: "ok" };
}

/** 설비의 현재 작업지시 바인딩 해제. 실패해도 화면 흐름을 막지 않는다. */
export async function releaseEquipJobOrder(equipCode: string): Promise<void> {
  try {
    await api.patch(`/equipment/equips/${encodeURIComponent(equipCode)}/job-order`, { orderNo: null }, { suppressErrorModal: true });
  } catch {
    // 해제 실패는 다음 복원 때 다시 시도된다
  }
}

/** 저장된 지시번호로 지시를 조회. 404 등 조회 실패는 null(=missing)로 돌려 호출자가 바인딩을 정리하게 한다. */
export async function fetchRestoredJobOrder<T extends { orderNo?: string | null; status?: string | null }>(orderNo: string): Promise<T | null> {
  try {
    const res = await api.get(`/production/job-orders/order-no/${encodeURIComponent(orderNo)}`, { suppressErrorModal: true });
    return (res.data?.data as T | null | undefined) ?? null;
  } catch {
    return null;
  }
}
