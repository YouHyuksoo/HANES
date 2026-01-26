/**
 * @file packages/shared/src/types/production.ts
 * @description 생산 관련 타입 정의
 *
 * 초보자 가이드:
 * 1. **작업지시(JobOrder)**: 생산 계획에서 내려온 실제 작업 지시
 * 2. **생산실적(ProdResult)**: 작업자가 입력한 생산 결과
 * 3. **공정매핑(ProcessMap)**: 품목별 공정 순서 정의
 */

import { ProcessType, WorkStatus, JobOrderType } from './enums';
import { Traceability4M } from './traceability';

/** 작업지시 */
export interface JobOrder {
  id: string;
  jobOrderNo: string;
  plantId: string;
  lineId: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  completedQty: number;
  defectQty: number;
  unit: string;
  orderType: JobOrderType;
  priority: number;
  planStartDate: string;
  planEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  status: WorkStatus;
  bomRevision?: string;
  customerCode?: string;
  customerOrderNo?: string;
  parentJobOrderId?: string;  // 상위 작업지시 (재작업 등)
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 작업지시 상세 (공정별) */
export interface JobOrderDetail {
  id: string;
  jobOrderId: string;
  seq: number;
  processCode: string;
  processName: string;
  lineId?: string;
  equipmentId?: string;
  planQty: number;
  completedQty: number;
  defectQty: number;
  status: WorkStatus;
  planStartTime?: string;
  planEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

/** 생산실적 */
export interface ProdResult {
  id: string;
  jobOrderId: string;
  jobOrderDetailId?: string;
  resultNo: string;
  plantId: string;
  lineId: string;
  processCode: string;
  itemCode: string;
  itemName: string;
  lotNo: string;
  inputQty: number;
  outputQty: number;
  defectQty: number;
  unit: string;
  workDate: string;
  shiftCode?: string;
  startTime: string;
  endTime: string;
  cycleTime?: number;
  equipmentId?: string;
  operatorId: string;
  operatorName: string;
  trace4M?: Traceability4M;
  isConfirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 공정별 생산실적 상세 */
export interface ProdResultDetail {
  id: string;
  prodResultId: string;
  seq: number;
  materialLotNo: string;
  materialItemCode: string;
  usedQty: number;
  unit: string;
}

/** 품목별 공정 매핑 */
export interface ProcessMap {
  id: string;
  itemCode: string;
  itemName: string;
  seq: number;
  processCode: string;
  processName: string;
  processType: ProcessType;
  lineId?: string;
  standardTime?: number;
  isRequired: boolean;
  isActive: boolean;
  description?: string;
}

/** 절단 공정 실적 */
export interface CuttingResult {
  id: string;
  prodResultId: string;
  wireItemCode: string;
  wireItemName: string;
  wireLotNo: string;
  cutLength: number;           // 절단 길이 (mm)
  stripLength1?: number;       // Strip 길이1 (mm)
  stripLength2?: number;       // Strip 길이2 (mm)
  bladeId?: string;            // 날 ID
  bladeUsageCount?: number;
  machineSpeed?: number;
  tension?: number;
}

/** 압착 공정 실적 */
export interface CrimpingResult {
  id: string;
  prodResultId: string;
  terminalItemCode: string;
  terminalItemName: string;
  terminalLotNo: string;
  crimpHeight?: number;        // 압착 높이 (mm)
  crimpWidth?: number;         // 압착 폭 (mm)
  pullForce?: number;          // 인장력 (N)
  applicatorId?: string;       // 어플리케이터 ID
  applicatorUsageCount?: number;
  crimpPosition: 'LEFT' | 'RIGHT' | 'BOTH';
}

/** 조립 공정 실적 */
export interface AssemblyResult {
  id: string;
  prodResultId: string;
  housingItemCode?: string;
  housingItemName?: string;
  housingLotNo?: string;
  cavityNo?: number;
  insertionForce?: number;
  isLockConfirmed?: boolean;
}

/** 검사 공정 실적 */
export interface InspectionResult {
  id: string;
  prodResultId: string;
  inspectionType: string;
  testVoltage?: number;
  testCurrent?: number;
  resistanceValue?: number;
  insulationValue?: number;
  isPassed: boolean;
  failReason?: string;
}

/** 작업 투입 자재 */
export interface WorkMaterialInput {
  id: string;
  jobOrderId: string;
  prodResultId?: string;
  materialItemCode: string;
  materialItemName: string;
  materialLotNo: string;
  requiredQty: number;
  issuedQty: number;
  usedQty: number;
  unit: string;
  warehouseId: string;
  locationId?: string;
  issuedAt?: string;
  issuedBy?: string;
}

/** 라인 가동 현황 */
export interface LineStatus {
  lineId: string;
  lineCode: string;
  lineName: string;
  currentJobOrderId?: string;
  currentJobOrderNo?: string;
  currentItemCode?: string;
  currentItemName?: string;
  status: 'RUNNING' | 'IDLE' | 'SETUP' | 'BREAKDOWN' | 'MAINTENANCE';
  currentOperatorId?: string;
  currentOperatorName?: string;
  todayPlanQty: number;
  todayActualQty: number;
  todayDefectQty: number;
  achievementRate: number;
  lastUpdateTime: string;
}

/** 생산 일일 현황 */
export interface DailyProductionSummary {
  workDate: string;
  plantId: string;
  lineId: string;
  itemCode: string;
  itemName: string;
  planQty: number;
  actualQty: number;
  defectQty: number;
  defectRate: number;
  achievementRate: number;
  workHours: number;
  productionSpeed: number;   // 시간당 생산량
}
