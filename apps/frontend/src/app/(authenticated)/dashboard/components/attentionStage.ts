/**
 * @file src/app/(authenticated)/dashboard/components/attentionStage.ts
 * @description 조치 항목 → "역(단계)" 매핑. 노선도·시계판 형태가 단계별로 조치를 나눠 보여줄 때 쓰는 순수 함수.
 *
 * 물류 라인 5역(입고→자재→생산→품질→제품)과 설비 라인 3역(일상/정기/예방보전)은
 * ValueStream 의 단계 정의와 같은 기준으로 나눈다. 보류 재고(holdStock)는 자재·제품이 섞여 오므로 자재역에 둔다.
 */
import type { AttentionItem } from "./types";

export type FlowStage = "receive" | "material" | "production" | "quality" | "product";
export type EquipStage = "daily" | "periodic" | "pm";
export type Station = FlowStage | EquipStage;

export const FLOW_STAGES: readonly FlowStage[] = ["receive", "material", "production", "quality", "product"];
export const EQUIP_STAGES: readonly EquipStage[] = ["daily", "periodic", "pm"];

const FLOW_OF_KEY: Record<string, FlowStage> = {
  expiredLot: "receive",
  nearExpiry: "receive",
  shortage: "material",
  holdStock: "material",
  equipStop: "production",
  holdOrder: "production",
  defectWait: "quality",
  repairWait: "quality",
};

export function stationOf(item: AttentionItem): Station {
  if (item.key === "inspectFail" || item.key === "inspectNotDone") {
    if (item.kindKey === "daily" || item.kindKey === "periodic" || item.kindKey === "pm") return item.kindKey;
  }
  return FLOW_OF_KEY[item.key] ?? "product";
}

/** 역별 압력(조치 건수 합) — 0 인 역은 키가 없다 */
export function pressureByStation(items: AttentionItem[]): Partial<Record<Station, number>> {
  const out: Partial<Record<Station, number>> = {};
  for (const item of items) {
    const st = stationOf(item);
    out[st] = (out[st] ?? 0) + item.count;
  }
  return out;
}

/** 압력 → 의미 톤 클래스 접미(success/warning/error). 6건 이상이면 빨강, 1건 이상 노랑 */
export function pressureTone(pressure: number): "success" | "warning" | "error" {
  return pressure >= 6 ? "error" : pressure > 0 ? "warning" : "success";
}
