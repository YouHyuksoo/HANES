/**
 * @file src/stores/inputInspectStore.ts
 * @description 검사 실적 입력 상태 관리 (페이지별 독립)
 *
 * 초보자 가이드:
 * 선택 흐름: 라인 → 공정 → 설비 → 작업지시 → 작업자 (5단계 필수)
 * 상위 선택 변경 시 하위 선택은 자동 초기화됨
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';

export interface SelectedLine {
  lineCode: string;
  lineName: string;
}

export interface SelectedProcess {
  processCode: string;
  processName: string;
}

export interface SelectedEquip {
  id: string;
  equipCode: string;
  equipName: string;
}

interface InputInspectState {
  selectedLine: SelectedLine | null;
  selectedProcess: SelectedProcess | null;
  selectedEquip: SelectedEquip | null;
  selectedJobOrder: JobOrder | null;
  selectedWorker: Worker | null;
  setSelectedLine: (line: SelectedLine | null) => void;
  setSelectedProcess: (process: SelectedProcess | null) => void;
  setSelectedEquip: (equip: SelectedEquip | null) => void;
  setSelectedJobOrder: (jobOrder: JobOrder | null) => void;
  setSelectedWorker: (worker: Worker | null) => void;
  clearSelection: () => void;
}

export const useInputInspectStore = create<InputInspectState>()(
  persist(
    (set) => ({
      selectedLine: null,
      selectedProcess: null,
      selectedEquip: null,
      selectedJobOrder: null,
      selectedWorker: null,
      setSelectedLine: (line) => set({
        selectedLine: line,
        selectedProcess: null,
        selectedEquip: null,
        selectedJobOrder: null,
      }),
      setSelectedProcess: (process) => set({
        selectedProcess: process,
        selectedEquip: null,
        selectedJobOrder: null,
      }),
      setSelectedEquip: (equip) => set({
        selectedEquip: equip,
        selectedJobOrder: null,
      }),
      setSelectedJobOrder: (jobOrder) => set({ selectedJobOrder: jobOrder }),
      setSelectedWorker: (worker) => set({ selectedWorker: worker }),
      clearSelection: () => set({
        selectedLine: null,
        selectedProcess: null,
        selectedEquip: null,
        selectedJobOrder: null,
        selectedWorker: null,
      }),
    }),
    { name: 'harness-input-inspect' }
  )
);
