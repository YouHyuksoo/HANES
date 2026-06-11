/**
 * @file src/stores/kioskStore.ts
 * @description 생산실적 키오스크 화면 전용 상태 관리 (Zustand persist)
 *
 * 초보자 가이드:
 * - 설비 선택 → 준비단계 체크 → 작업 화면 순서로 진행
 * - interlock: 각 준비 조건의 완료 여부 (모두 true여야 실적입력 가능)
 * - pendingDefects: 실적 저장 전 임시 보관 불량 목록 (저장 시 defect-logs API 연동)
 * - persist: 페이지 새로고침 후에도 선택 상태 유지 (localStorage)
 * - clearAll: 작업 완료 후 또는 설비 변경 시 전체 초기화
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';

/** 실적 저장 전 임시 보관 불량 항목 */
export interface PendingDefect {
  defectCode: string;
  defectName: string;
  qty: number;
}

/** 스캔 완료된 자재 롯트 정보 */
export interface ScannedMaterialLot {
  itemCode: string;
  seq: number;
  matUid: string;
  initQty: number;
}

/** 자주검사 시점 판별 */
export type InspectTiming = 'FIRST' | 'MID' | 'LAST';

export interface KioskEquip {
  equipCode: string;
  equipName: string;
  processCode?: string;
  processName?: string;
}

/** 인터락 체크 상태 — 모두 true여야 실적 입력 가능 */
export interface KioskInterlock {
  /** 설비 일일점검 완료 여부 (1일 1회, 설비담당) */
  dailyInspectDone: boolean;
  /** 작업자설비점검 완료 여부 (작업지시 변경 시) */
  workerInspectDone: boolean;
  /** BOM 자재 스캔 확인 완료 여부 */
  materialScanDone: boolean;
  /** 소모성 부품 스캔 확인 완료 여부 */
  consumableScanDone: boolean;
}

interface KioskState {
  selectedEquip: KioskEquip | null;
  selectedJobOrder: JobOrder | null;
  selectedWorkers: Worker[];
  lotSize: number;
  serialSeq: number;
  /** 준비단계 인터락 상태 */
  interlock: KioskInterlock;
  /** 스캔 완료된 자재 롯트 정보 */
  scannedMaterialLots: ScannedMaterialLot[];
  /** 스캔 확인된 소모품 코드 목록 */
  scannedConsumables: string[];
  /** 실적 저장 전 임시 보관 불량 목록 */
  pendingDefects: PendingDefect[];
  /** 현재 작업지시의 누적 생산수량(양품+불량, 서버 PROD_RESULTS 집계 기준) — 초물/중물 트리거·진행률·검사 시점 생산량에 사용 */
  savedResultCount: number;
  /** 의뢰검사 대기 여부 (true 이면 실적입력 차단) */
  hasPendingDelegate: boolean;
  /** 중물 자주검사 완료 여부 (진행률 차단 해제용) */
  midInspectDone: boolean;

  setSelectedEquip: (equip: KioskEquip | null) => void;
  setSelectedJobOrder: (jobOrder: JobOrder | null) => void;
  addWorker: (worker: Worker) => void;
  removeWorker: (workerId: string) => void;
  setLotSize: (size: number) => void;
  incrementSerial: () => void;
  resetSerial: () => void;
  setInterlock: (key: keyof KioskInterlock, value: boolean) => void;
  addScannedMaterialLot: (lot: ScannedMaterialLot) => void;
  removeScannedMaterialLot: (itemCode: string, seq: number) => void;
  clearScannedMaterialLots: () => void;
  addScannedConsumable: (consumableCode: string) => void;
  addPendingDefect: (defect: PendingDefect) => void;
  removePendingDefect: (defectCode: string) => void;
  clearPendingDefects: () => void;
  setSavedResultCount: (count: number) => void;
  setHasPendingDelegate: (value: boolean) => void;
  setMidInspectDone: (value: boolean) => void;
  clearAll: () => void;
}

const DEFAULT_INTERLOCK: KioskInterlock = {
  dailyInspectDone: false,
  workerInspectDone: false,
  materialScanDone: false,
  consumableScanDone: false,
};

export const useKioskStore = create<KioskState>()(
  persist(
    (set) => ({
      selectedEquip: null,
      selectedJobOrder: null,
      selectedWorkers: [],
      lotSize: 1,
      serialSeq: 1,
      interlock: DEFAULT_INTERLOCK,
      scannedMaterialLots: [],
      scannedConsumables: [],
      pendingDefects: [],
      savedResultCount: 0,
      hasPendingDelegate: false,
      midInspectDone: false,

      setSelectedEquip: (equip) => set({
        selectedEquip: equip,
        selectedJobOrder: null,
        selectedWorkers: [],
        serialSeq: 1,
        interlock: DEFAULT_INTERLOCK,
        scannedMaterialLots: [],
        scannedConsumables: [],
        pendingDefects: [],
        savedResultCount: 0,
        hasPendingDelegate: false,
        midInspectDone: false,
      }),

      setSelectedJobOrder: (jobOrder) => set({
        selectedJobOrder: jobOrder,
        serialSeq: 1,
        // 작업지시 변경 시 작업자점검·자재·소모품 스캔 초기화
        interlock: { ...DEFAULT_INTERLOCK, dailyInspectDone: true },
        scannedMaterialLots: [],
        scannedConsumables: [],
        pendingDefects: [],
        savedResultCount: 0,
        hasPendingDelegate: false,
        midInspectDone: false,
      }),

      addWorker: (worker) => set((state) => {
        if (state.selectedWorkers.some(w => w.id === worker.id)) return state;
        return { selectedWorkers: [...state.selectedWorkers, worker] };
      }),

      removeWorker: (workerId) => set((state) => ({
        selectedWorkers: state.selectedWorkers.filter(w => w.id !== workerId),
      })),

      setLotSize: (size) => set({ lotSize: size }),

      incrementSerial: () => set((state) => ({ serialSeq: state.serialSeq + 1 })),

      resetSerial: () => set({ serialSeq: 1 }),

      setInterlock: (key, value) => set((state) => ({
        interlock: { ...state.interlock, [key]: value },
      })),

      addScannedMaterialLot: (lot) =>
        set(s => {
          const filtered = s.scannedMaterialLots.filter(
            l => !(l.itemCode === lot.itemCode && l.seq === lot.seq)
          );
          return { scannedMaterialLots: [...filtered, lot] };
        }),

      removeScannedMaterialLot: (itemCode, seq) =>
        set(s => ({
          scannedMaterialLots: s.scannedMaterialLots.filter(
            l => !(l.itemCode === itemCode && l.seq === seq)
          ),
        })),

      clearScannedMaterialLots: () => set({ scannedMaterialLots: [] }),

      addScannedConsumable: (consumableCode) => set((state) => {
        if (state.scannedConsumables.includes(consumableCode)) return state;
        return { scannedConsumables: [...state.scannedConsumables, consumableCode] };
      }),

      addPendingDefect: (defect) => set((state) => {
        const existing = state.pendingDefects.findIndex(d => d.defectCode === defect.defectCode);
        if (existing >= 0) {
          const updated = [...state.pendingDefects];
          updated[existing] = { ...updated[existing], qty: updated[existing].qty + defect.qty };
          return { pendingDefects: updated };
        }
        return { pendingDefects: [...state.pendingDefects, defect] };
      }),

      removePendingDefect: (defectCode) => set((state) => ({
        pendingDefects: state.pendingDefects.filter(d => d.defectCode !== defectCode),
      })),

      clearPendingDefects: () => set({ pendingDefects: [] }),

      setSavedResultCount: (count) => set({ savedResultCount: count }),

      setHasPendingDelegate: (value) => set({ hasPendingDelegate: value }),

      setMidInspectDone: (value) => set({ midInspectDone: value }),

      clearAll: () => set({
        selectedEquip: null,
        selectedJobOrder: null,
        selectedWorkers: [],
        lotSize: 1,
        serialSeq: 1,
        interlock: DEFAULT_INTERLOCK,
        scannedMaterialLots: [],
        scannedConsumables: [],
        pendingDefects: [],
        savedResultCount: 0,
        hasPendingDelegate: false,
        midInspectDone: false,
      }),
    }),
    {
      name: 'harness-kiosk',
      // selectedEquip(설비)·lotSize(사용자 설정)만 유지.
      // selectedJobOrder는 저장하지 않아 페이지 재진입 시 반드시 새로 선택.
      partialize: (state) => ({
        selectedEquip: state.selectedEquip,
        lotSize: state.lotSize,
      }),
      version: 2,
    }
  )
);

/**
 * 인터락 모두 완료 여부 확인
 */
export function isAllInterlockDone(interlock: KioskInterlock): boolean {
  return Object.values(interlock).every(Boolean);
}

/**
 * 시리얼 번호 생성 유틸
 * 형식: {orderNo}-{seq 3자리}
 */
export function buildSerialNo(orderNo: string, seq: number): string {
  return `${orderNo}-${String(seq).padStart(3, '0')}`;
}
