"use client";

/**
 * @file hooks/useEquipWorkers.ts
 * @description 실적입력 3화면(가공·서브조립·조립) 공용 "설비 현재 작업자" 훅
 *
 * - 선택 작업자는 kioskStore.selectedWorkers 한 곳에만 둔다.
 * - 추가/제거는 낙관적으로 스토어에 먼저 반영하고 설비(EQUIP_MASTERS.CURRENT_WORKER_CODES)에 저장한다.
 *   저장 실패 시 이전 목록으로 되돌리고 toast 로 알린다.
 * - 설비 선택(복원) 시 저장된 코드 목록으로 작업자를 다시 불러온다.
 */
import { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import type { Worker } from '@/components/worker/WorkerSelector';

export function parseCurrentWorkerCodes(value?: string | null): string[] {
  return [...new Set((value ?? '').split(',').map(code => code.trim()).filter(Boolean))];
}

export async function loadCurrentWorkers(currentWorkerCodes?: string | null): Promise<Worker[]> {
  const codes = parseCurrentWorkerCodes(currentWorkerCodes);
  return Promise.all(codes.map(async (code) => {
    const res = await api.get(`/master/workers/${encodeURIComponent(code)}`);
    const worker = res.data?.data;
    return {
      id: worker?.workerCode ?? code,
      workerCode: worker?.workerCode ?? code,
      workerName: worker?.workerName ?? code,
      dept: worker?.dept,
    } as Worker;
  }));
}

export async function persistCurrentWorkerCodes(equipCode: string | undefined, workers: Worker[]): Promise<void> {
  if (!equipCode) return;
  await api.patch(
    `/equipment/equips/${encodeURIComponent(equipCode)}/workers`,
    { workerCodes: workers.map(worker => worker.id) },
    { suppressErrorModal: true },
  );
}

export function useEquipWorkers(equipCode: string | undefined) {
  const { t } = useTranslation();
  const { selectedWorkers, setSelectedWorkers } = useKioskStore();

  const workerNames = useMemo(() => selectedWorkers.map(worker => worker.workerName), [selectedWorkers]);

  const persistOrRollback = useCallback(async (next: Worker[], previous: Worker[]) => {
    setSelectedWorkers(next);
    try {
      await persistCurrentWorkerCodes(equipCode, next);
    } catch {
      setSelectedWorkers(previous);
      toast.error(t('kiosk.header.workerAssignError', '현재 작업자 저장에 실패했습니다.'));
    }
  }, [equipCode, setSelectedWorkers, t]);

  /** 작업자 선택 모달 확인 — 이미 있으면 그대로 두고, 없으면 뒤에 붙인다 */
  const addWorker = useCallback(async (worker: Worker) => {
    const next = selectedWorkers.some(w => w.id === worker.id) ? selectedWorkers : [...selectedWorkers, worker];
    await persistOrRollback(next, selectedWorkers);
  }, [persistOrRollback, selectedWorkers]);

  const removeWorker = useCallback(async (workerId: string) => {
    await persistOrRollback(selectedWorkers.filter(worker => worker.id !== workerId), selectedWorkers);
  }, [persistOrRollback, selectedWorkers]);

  /** 설비 복원 시 저장된 코드로 작업자를 다시 채운다. 실패하면 비우고 호출자가 복원 실패로 처리하도록 다시 던진다 */
  const restoreWorkers = useCallback(async (currentWorkerCodes?: string | null) => {
    try {
      setSelectedWorkers(await loadCurrentWorkers(currentWorkerCodes));
    } catch (error: unknown) {
      setSelectedWorkers([]);
      throw error;
    }
  }, [setSelectedWorkers]);

  const clearWorkers = useCallback(() => setSelectedWorkers([]), [setSelectedWorkers]);

  return { selectedWorkers, workerNames, addWorker, removeWorker, restoreWorkers, clearWorkers };
}
