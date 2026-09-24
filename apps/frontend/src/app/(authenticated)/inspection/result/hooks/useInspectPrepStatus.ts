"use client";

/**
 * @file inspection/result/hooks/useInspectPrepStatus.ts
 * @description 통전·단자검사 준비 상태 단일 소스 — 작업자/설비점검/양불대조/소모품을 한 객체로 모은다.
 *
 * 초보자 가이드:
 * 1. 설비점검·양불대조 판정은 서버(GET /quality/continuity-inspect/prep-status)가 내린다.
 *    화면은 그 결과를 표시만 하고 임의로 통과시키지 않는다.
 * 2. 소모품 장착 여부는 좌측 ConsumablePanel이 setConsumableStatus로 보고한다.
 * 3. 작업자는 검사기의 현재 작업자(EQUIP_MASTERS.CURRENT_WORKER_CODES)를 원본으로 쓴다.
 *    실적입력(가공) 키오스크와 같은 배정 API를 쓴다.
 * 4. ready = 작업자 1명 이상 + 서버 준비완료 + 소모품 장착완료.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import type { Worker } from "@/components/worker/WorkerSelector";

export interface InspectGateState {
  dailyRequired: boolean;
  dailyDone: boolean;
  dailyResult: string | null;
  dailyInspectedAt: string | null;
  workerRequired: boolean;
  workerDone: boolean;
  workerResult: string | null;
  workerInspectedAt: string | null;
  blocked: boolean;
  blockReason: string | null;
}

export interface SampleCheckState {
  required: boolean;
  done: boolean;
  checkNo: string | null;
  overallResult: string | null;
  checkedAt: string | null;
  workDate: string;
  shiftCode: string;
  candidateCount: number;
  blockReason: string | null;
}

export interface InspectPrepState {
  gate: InspectGateState;
  sampleCheck: SampleCheckState | null;
  workers: Worker[];
  consumablesReady: boolean;
  unmountedConsumCount: number;
  loading: boolean;
  /** 판정 버튼 활성 조건 */
  ready: boolean;
  /** 비활성 사유(첫 번째) */
  blockReason: string | null;
  refresh: () => Promise<void>;
  setWorkers: (workers: Worker[]) => void;
  setConsumableStatus: (allMounted: boolean, unmounted: number) => void;
}

const EMPTY_GATE: InspectGateState = {
  dailyRequired: false,
  dailyDone: false,
  dailyResult: null,
  dailyInspectedAt: null,
  workerRequired: false,
  workerDone: false,
  workerResult: null,
  workerInspectedAt: null,
  blocked: false,
  blockReason: null,
};

interface UseInspectPrepStatusArgs {
  orderNo?: string;
  itemCode?: string;
  inspectType: "CONTINUITY" | "TERMINAL" | "HIPOT" | "LEAK" | "TORQUE" | "VISION" | "RELAY_FUNCTION";
  equipCode?: string;
  /** 작업자 미선택 안내 문구 */
  noWorkerMessage: string;
  /** 검사기 미선택 안내 문구 */
  noEquipMessage: string;
  /** 소모품 미장착 안내 문구 */
  consumableMessage: string;
}

export function useInspectPrepStatus({
  orderNo,
  itemCode,
  inspectType,
  equipCode,
  noWorkerMessage,
  noEquipMessage,
  consumableMessage,
}: UseInspectPrepStatusArgs): InspectPrepState {
  const [gate, setGate] = useState<InspectGateState>(EMPTY_GATE);
  const [sampleCheck, setSampleCheck] = useState<SampleCheckState | null>(null);
  const [serverReady, setServerReady] = useState(false);
  const [serverBlockReason, setServerBlockReason] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [consumablesReady, setConsumablesReady] = useState(true);
  const [unmountedConsumCount, setUnmountedConsumCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const setConsumableStatus = useCallback((allMounted: boolean, unmounted: number) => {
    setConsumablesReady(allMounted);
    setUnmountedConsumCount(unmounted);
  }, []);

  /**
   * 검사기의 현재 작업자 복원 — 새로고침·검사기 변경 시 화면 상태를 서버와 맞춘다.
   * 실적입력(가공) 키오스크와 같은 방식: CURRENT_WORKER_CODES(CSV) -> 작업자 마스터 조회.
   */
  const loadWorkers = useCallback(async () => {
    if (!equipCode) {
      setWorkers([]);
      return;
    }
    try {
      const res = await api.get(`/equipment/equips/${encodeURIComponent(equipCode)}`);
      const raw = res.data?.data?.currentWorkerCodes;
      const codes = typeof raw === "string"
        ? raw.split(",").map((code) => code.trim()).filter(Boolean)
        : [];
      if (codes.length === 0) {
        setWorkers([]);
        return;
      }
      const loaded = await Promise.all(codes.map(async (code) => {
        try {
          const workerRes = await api.get(`/master/workers/${encodeURIComponent(code)}`, { suppressErrorModal: true });
          const worker = workerRes.data?.data;
          return {
            id: worker?.workerCode ?? code,
            workerCode: worker?.workerCode ?? code,
            workerName: worker?.workerName ?? code,
            dept: worker?.dept ?? "",
          } as Worker;
        } catch {
          return { id: code, workerCode: code, workerName: code, dept: "" } as Worker;
        }
      }));
      setWorkers(loaded);
    } catch {
      setWorkers([]);
    }
  }, [equipCode]);

  const refresh = useCallback(async () => {
    if (!orderNo || !itemCode || !equipCode) {
      setGate(EMPTY_GATE);
      setSampleCheck(null);
      setServerReady(false);
      setServerBlockReason(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/quality/continuity-inspect/prep-status", {
        params: { orderNo, inspectType, itemCode, equipCode },
      });
      const data = res.data?.data ?? {};
      setGate((data.gate as InspectGateState) ?? EMPTY_GATE);
      setSampleCheck((data.sampleCheck as SampleCheckState | null) ?? null);
      setServerReady(Boolean(data.ready));
      setServerBlockReason((data.blockReason as string | null) ?? null);
    } catch (error: unknown) {
      // 조회 실패 시 임의로 통과시키지 않는다. 미완료로 두고 사유를 남긴다.
      setGate(EMPTY_GATE);
      setSampleCheck(null);
      setServerReady(false);
      setServerBlockReason(error instanceof Error ? error.message : null);
    } finally {
      setLoading(false);
    }
  }, [orderNo, itemCode, inspectType, equipCode]);

  useEffect(() => { void loadWorkers(); }, [loadWorkers]);
  useEffect(() => { void refresh(); }, [refresh]);

  const ready = Boolean(equipCode) && workers.length > 0 && serverReady && consumablesReady;

  const blockReason = useMemo(() => {
    if (!equipCode) return noEquipMessage;
    if (workers.length === 0) return noWorkerMessage;
    if (serverBlockReason) return serverBlockReason;
    if (!consumablesReady) return `${consumableMessage} (${unmountedConsumCount})`;
    return null;
  }, [
    equipCode, workers.length, serverBlockReason, consumablesReady,
    unmountedConsumCount, noEquipMessage, noWorkerMessage, consumableMessage,
  ]);

  return {
    gate,
    sampleCheck,
    workers,
    consumablesReady,
    unmountedConsumCount,
    loading,
    ready,
    blockReason,
    refresh,
    setWorkers,
    setConsumableStatus,
  };
}

export default useInspectPrepStatus;
