import type { DefectLogStatusValue } from '@harness/shared';

export type DefectStatus = DefectLogStatusValue;

export interface Defect {
  id: string;
  occurAt: string;
  workOrderNo: string | null;
  prodResultNo: string;
  defectCode: string;
  defectName: string | null;
  qty: number;
  status: DefectStatus;
  cause: string | null;
  operator: string | null;
  equipmentNo: string | null;
}
