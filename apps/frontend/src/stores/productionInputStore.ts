/**
 * @file src/stores/productionInputStore.ts
 * @description 생산실적 입력 상태 관리 (페이지 이동 후에도 유지)
 * 
 * Zustand persist를 사용하여 localStorage에 자동 저장
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JobOrder } from '@/components/production/JobOrderSelectModal';
import type { Worker } from '@/components/worker/WorkerSelector';

interface ProductionInputState {
  // 선택된 작업지시
  selectedJobOrder: JobOrder | null;
  setSelectedJobOrder: (jobOrder: JobOrder | null) => void;
  
  // 선택된 작업자
  selectedWorker: Worker | null;
  setSelectedWorker: (worker: Worker | null) => void;
  
  // 초기화
  clearSelection: () => void;
}

export const useProductionInputStore = create<ProductionInputState>()(
  persist(
    (set) => ({
      selectedJobOrder: null,
      selectedWorker: null,
      
      setSelectedJobOrder: (jobOrder) => set({ selectedJobOrder: jobOrder }),
      setSelectedWorker: (worker) => set({ selectedWorker: worker }),
      
      clearSelection: () => set({ 
        selectedJobOrder: null, 
        selectedWorker: null 
      }),
    }),
    {
      name: 'harness-production-input', // localStorage 키
    }
  )
);
