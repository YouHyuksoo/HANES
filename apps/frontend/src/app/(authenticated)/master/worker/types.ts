/**
 * @file src/app/(authenticated)/master/worker/types.ts
 * @description 작업자관리 타입 + 시드 데이터
 */

export type WorkerType = "CUTTING" | "CRIMPING" | "ASSEMBLY" | "INSPECTOR" | "PACKING" | "LEADER";

export interface Worker {
  id: string;
  workerCode: string;
  workerName: string;
  workerType: WorkerType;
  dept: string | null;
  qrCode: string | null;
  photoUrl: string | null;
  processIds: string[] | null;
  useYn: string;
}

export const WORKER_TYPE_COLORS: Record<string, string> = {
  CUTTING: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  CRIMPING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ASSEMBLY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  INSPECTOR: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  PACKING: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  LEADER: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export const seedWorkers: Worker[] = [
  { id: "1", workerCode: "W-001", workerName: "김절단", workerType: "CUTTING", dept: "절단팀", qrCode: "QR-W001", photoUrl: null, processIds: ["CUT"], useYn: "Y" },
  { id: "2", workerCode: "W-002", workerName: "이절단", workerType: "CUTTING", dept: "절단팀", qrCode: "QR-W002", photoUrl: null, processIds: ["CUT"], useYn: "Y" },
  { id: "3", workerCode: "W-003", workerName: "박압착", workerType: "CRIMPING", dept: "압착팀", qrCode: "QR-W003", photoUrl: null, processIds: ["CRM"], useYn: "Y" },
  { id: "4", workerCode: "W-004", workerName: "최압착", workerType: "CRIMPING", dept: "압착팀", qrCode: "QR-W004", photoUrl: null, processIds: ["CRM"], useYn: "Y" },
  { id: "5", workerCode: "W-005", workerName: "정조립", workerType: "ASSEMBLY", dept: "조립팀", qrCode: "QR-W005", photoUrl: null, processIds: ["ASM"], useYn: "Y" },
  { id: "6", workerCode: "W-006", workerName: "한조립", workerType: "ASSEMBLY", dept: "조립팀", qrCode: "QR-W006", photoUrl: null, processIds: ["ASM"], useYn: "Y" },
  { id: "7", workerCode: "W-007", workerName: "오조립", workerType: "ASSEMBLY", dept: "조립팀", qrCode: "QR-W007", photoUrl: null, processIds: ["ASM"], useYn: "Y" },
  { id: "8", workerCode: "W-008", workerName: "강검사", workerType: "INSPECTOR", dept: "품질팀", qrCode: "QR-W008", photoUrl: null, processIds: ["INS"], useYn: "Y" },
  { id: "9", workerCode: "W-009", workerName: "윤검사", workerType: "INSPECTOR", dept: "품질팀", qrCode: "QR-W009", photoUrl: null, processIds: ["INS"], useYn: "Y" },
  { id: "10", workerCode: "W-010", workerName: "장포장", workerType: "PACKING", dept: "포장팀", qrCode: "QR-W010", photoUrl: null, processIds: ["PKG"], useYn: "Y" },
  { id: "11", workerCode: "W-011", workerName: "임포장", workerType: "PACKING", dept: "포장팀", qrCode: "QR-W011", photoUrl: null, processIds: ["PKG"], useYn: "Y" },
  { id: "12", workerCode: "W-012", workerName: "송반장", workerType: "LEADER", dept: "절단팀", qrCode: "QR-W012", photoUrl: null, processIds: ["CUT", "CRM"], useYn: "Y" },
  { id: "13", workerCode: "W-013", workerName: "류반장", workerType: "LEADER", dept: "조립팀", qrCode: "QR-W013", photoUrl: null, processIds: ["ASM", "INS"], useYn: "Y" },
  { id: "14", workerCode: "W-014", workerName: "배압착", workerType: "CRIMPING", dept: "압착팀", qrCode: "QR-W014", photoUrl: null, processIds: ["CRM"], useYn: "N" },
  { id: "15", workerCode: "W-015", workerName: "조검사", workerType: "INSPECTOR", dept: "품질팀", qrCode: "QR-W015", photoUrl: null, processIds: ["INS"], useYn: "Y" },
];
