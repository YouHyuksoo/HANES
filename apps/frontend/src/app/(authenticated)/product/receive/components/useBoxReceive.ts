"use client";

/**
 * @file components/useBoxReceive.ts
 * @description 박스 입고 공유 훅 - 입고 대상(미입고 CLOSED 박스) 조회 + 일괄 입고 처리
 *
 * 초보자 가이드:
 * - 입고 대상 = CLOSED 상태 박스 중, 아직 정상(DONE) 입고가 잡히지 않은 박스
 * - 완제품(FINISHED) → FG 입고, 반제품(SEMI_PRODUCT) → WIP 입고
 * - 백엔드에도 이중입고 가드가 있으므로 프론트 필터는 UX 편의용
 */

import { useState, useCallback, useEffect } from "react";
import api from "@/services/api";

export interface ReceiveCandidate {
  boxNo: string;
  itemCode: string;
  itemName: string | null;
  itemType: string | null; // FINISHED | SEMI_PRODUCT
  qty: number;
  status: string;
}

export interface ReceiveResult {
  ok: string[];
  failed: { boxNo: string; reason: string }[];
}

/** 품목유형 → 입고 엔드포인트 */
function endpointFor(itemType: string | null): string {
  return itemType === "SEMI_PRODUCT" ? "/inventory/wip/receive" : "/inventory/fg/receive";
}

/**
 * 박스 목록을 일괄 입고.
 * 순차 처리: 제품 트랜잭션번호 채번이 SELECT MAX+1 방식이라 병렬 전송 시
 * 동일 번호가 생성되어 PK(PK_PRODUCT_TRANSACTIONS) 충돌이 난다. 한 건씩 await 한다.
 * 한 박스가 실패해도 나머지는 계속 진행하고, 실패 목록을 모아 보고한다.
 */
export async function receiveBoxes(
  boxes: ReceiveCandidate[],
  warehouseId: string,
): Promise<ReceiveResult> {
  const ok: string[] = [];
  const failed: { boxNo: string; reason: string }[] = [];

  for (const b of boxes) {
    try {
      await api.post(endpointFor(b.itemType), {
        warehouseId,
        itemCode: b.itemCode,
        qty: b.qty,
        refType: "BOX",
        refId: b.boxNo,
        remark: `박스입고:${b.boxNo}`,
      });
      ok.push(b.boxNo);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      failed.push({ boxNo: b.boxNo, reason: err?.response?.data?.message ?? "입고 실패" });
    }
  }

  return { ok, failed };
}

/**
 * 입고 대상(미입고 CLOSED 박스) 조회 훅
 * @param itemType FINISHED | SEMI_PRODUCT (탭 기준)
 */
export function useReceiveCandidates(itemType: "FINISHED" | "SEMI_PRODUCT") {
  const [candidates, setCandidates] = useState<ReceiveCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      // 1) CLOSED 박스 목록 + 2) 정상 입고된 박스 refId 집합을 병렬 조회
      const [boxRes, txRes] = await Promise.all([
        api.get("/shipping/boxes", { params: { status: "CLOSED", limit: 500 } }),
        api.get("/inventory/product/transactions", {
          params: { refType: "BOX", transType: "FG_IN,WIP_IN", limit: 1000 },
        }),
      ]);

      const boxes = (boxRes.data?.data ?? []) as Array<{
        boxNo: string;
        itemCode: string;
        itemName: string | null;
        itemType: string | null;
        qty: number;
        status: string;
      }>;

      // 정상(DONE) 입고만 입고완료로 간주 → 취소 후 재입고 가능
      const receivedRefIds = new Set(
        ((txRes.data?.data ?? []) as Array<{ refId: string | null; status: string }>)
          .filter((t) => t.status === "DONE" && t.refId)
          .map((t) => t.refId as string),
      );

      const filtered = boxes
        .filter((b) => b.status === "CLOSED")
        .filter((b) => !receivedRefIds.has(b.boxNo))
        .filter((b) => (b.itemType ?? "FINISHED") === itemType)
        .map((b) => ({
          boxNo: b.boxNo,
          itemCode: b.itemCode,
          itemName: b.itemName,
          itemType: b.itemType,
          qty: Number(b.qty) || 0,
          status: b.status,
        }));

      setCandidates(filtered);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [itemType]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { candidates, loading, refetch };
}
