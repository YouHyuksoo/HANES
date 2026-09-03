/**
 * @file src/app/(authenticated)/dashboard/components/types.ts
 * @description 대시보드 뷰모델 타입 — 4개 API(dashboard/summary + monitoring 보드 3종)를 합친 형태
 *
 * 초보자 가이드:
 * 1. `DashboardSummary` = GET /dashboard/summary (PKG_DASHBOARD) 응답
 * 2. 생산/품질/재고 보드 타입은 모니터링 화면의 타입을 그대로 재사용한다 (단일 출처)
 * 3. `AttentionItem` 은 buildAttention 이 만드는 "조치 필요" 큐 한 줄
 */
import type { ProductionBoardData } from "@/app/(authenticated)/monitoring/production-board/components/types";
import type { QualityBoardData } from "@/app/(authenticated)/monitoring/quality-board/components/types";
import type { InventoryBoardData } from "@/app/(authenticated)/monitoring/inventory-board/components/types";

export type { ProductionBoardData, QualityBoardData, InventoryBoardData };

export interface EquipStats {
  normal: number;
  maint: number;
  stop: number;
  total: number;
}

export interface JobStats {
  wait: number;
  running: number;
  done: number;
  total: number;
}

export interface MatAlert {
  lowStock: number;
  nearExpiry: number;
  expired: number;
}

export interface DefectStats {
  wait: number;
  repair: number;
  rework: number;
  done: number;
  total: number;
}

export interface InspectItem {
  equipCode: string;
  equipName: string;
  result: string | null;
  inspectorName?: string | null;
  lineCode?: string | null;
}

export interface InspectSummary {
  items: InspectItem[];
  total: number;
  completed: number;
  pass: number;
  fail: number;
}

export interface DashboardSummary {
  equip: EquipStats;
  job: JobStats;
  mat: MatAlert;
  defect: DefectStats;
  daily: InspectSummary;
  periodic: InspectSummary;
  pm: InspectSummary;
}

/** 4개 API 를 합친 대시보드 원천 데이터 (실패한 API 는 null) */
export interface DashboardData {
  summary: DashboardSummary | null;
  production: ProductionBoardData | null;
  quality: QualityBoardData | null;
  inventory: InventoryBoardData | null;
}

export type AttentionSeverity = "critical" | "high" | "medium" | "low";

/** 조치 필요 한 줄을 펼쳤을 때 보이는 개별 항목 (설비/LOT/지시 단위) */
export interface AttentionDetail {
  /** 식별자 — 설비코드 · matUid · 지시번호 등 */
  code: string;
  /** 사람이 읽는 이름 — 설비명 · 품목명 */
  name: string;
  /** 보조 정보 — 라인 · 잔여일 · 보류 사유 · 재고/안전재고 */
  meta?: string;
}

export interface AttentionItem {
  /** i18n 키 접미사 (dashboard.attention.{key}) */
  key: string;
  severity: AttentionSeverity;
  count: number;
  /** 대표 항목(품목명/지시번호 등) 최대 3개 — 접힌 상태의 한 줄 요약 */
  samples: string[];
  /** 펼쳤을 때 보이는 전체 목록. 건수만 집계되는 항목(설비정지·불량미처리·수리대기)은 빈 배열 */
  details: AttentionDetail[];
  /** 이동할 화면 경로 */
  href: string;
  /** inspectNotDone 처럼 종류 구분이 필요한 경우 */
  kindKey?: string;
}

export const emptyInspect: InspectSummary = { items: [], total: 0, completed: 0, pass: 0, fail: 0 };
