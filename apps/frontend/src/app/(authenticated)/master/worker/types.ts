/**
 * @file src/app/(authenticated)/master/worker/types.ts
 * @description 작업자관리 타입 정의
 */

import type { UseYn } from "@/types";

/** 작업자 유형 */
export type WorkerType =
  | "CUTTING"
  | "CRIMPING"
  | "ASSEMBLY"
  | "INSPECTOR"
  | "PACKING"
  | "LEADER";

/** 작업자 인터페이스 */
export interface Worker {
  id: string;
  workerCode: string;
  workerName: string;
  engName?: string;
  workerType?: WorkerType;
  dept?: string;
  position?: string;
  phone?: string;
  email?: string;
  hireDate?: string;
  quitDate?: string;
  qrCode?: string;
  photoUrl?: string;
  processIds?: string[];
  remark?: string;
  useYn: UseYn;
}

/** 작업자 유형별 색상 */
export const WORKER_TYPE_COLORS: Record<string, string> = {
  CUTTING:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  CRIMPING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ASSEMBLY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  INSPECTOR:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  PACKING: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  LEADER: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};
