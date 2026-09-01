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
