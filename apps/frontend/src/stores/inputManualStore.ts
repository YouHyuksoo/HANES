/**
 * @file src/stores/inputManualStore.ts
 * @description 수작업 실적 입력 상태 관리 (페이지별 독립)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';

interface InputManualState {
  selectedJobOrder: JobOrder | null;
  selectedWorker: Worker | null;
  setSelectedJobOrder: (jobOrder: JobOrder | null) => void;
  setSelectedWorker: (worker: Worker | null) => void;
  clearSelection: () => void;
}

export const useInputManualStore = create<InputManualState>()(
  persist(
    (set) => ({
      selectedJobOrder: null,
      selectedWorker: null,
      setSelectedJobOrder: (jobOrder) => set({ selectedJobOrder: jobOrder }),
      setSelectedWorker: (worker) => set({ selectedWorker: worker }),
      clearSelection: () => set({ selectedJobOrder: null, selectedWorker: null }),
    }),
    { name: 'harness-input-manual' }
  )
);
