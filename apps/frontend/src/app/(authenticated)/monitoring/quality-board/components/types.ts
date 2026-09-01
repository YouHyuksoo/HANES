/**
 * @file src/app/(authenticated)/monitoring/quality-board/components/types.ts
 * @description 품질 보드 API 응답 타입 — GET /monitoring/boards/quality
 */

export interface QualityKpi {
  totalQty: number;
  defectQty: number;
  defectRate: number;
}

export interface ProcessDefect {
  processCode: string;
  totalQty: number;
  defectQty: number;
  defectRate: number;
}

export interface TopDefect {
  defectCode: string;
  defectName: string;
  qty: number;
}

export interface RepairStatus {
  received: number;
  inRepair: number;
  completedToday: number;
}

export interface DailyDefectPoint {
  date: string;
  totalQty: number;
  defectQty: number;
  defectRate: number;
}

export interface QualityBoardData {
  kpi: QualityKpi;
  byProcess: ProcessDefect[];
  topDefects: TopDefect[];
  repair: RepairStatus;
  dailyTrend: DailyDefectPoint[];
}

/** 품질 전광판 스킨 공통 props — page.tsx가 데이터/순환 상태를 내려준다 */
export interface QualitySkinProps {
  kpi?: QualityKpi;
  byProcess: ProcessDefect[];
  /** 자동 순환된 공정 슬라이스 (목록형 스킨용) */
  byProcessPageItems: ProcessDefect[];
  page: number;
  pageCount: number;
  topDefects: TopDefect[];
  repair?: RepairStatus;
  dailyTrend: DailyDefectPoint[];
  rollingSec: number;
  updatedAt: string;
}
