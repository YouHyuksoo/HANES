"use client";

/**
 * @file input-kiosk/hooks/useEquipStop.ts
 * @description 키오스크 설비정지 / 관리자호출 상태 훅
 *
 * 초보자 가이드:
 * 1. 경과시간의 기준은 **서버**다. 서버가 준 경과초(lossSeconds/elapsedSeconds)를 기준점으로 잡고
 *    화면에서 1초씩 더해 보여준다. 폴링(10초)마다 서버 값으로 다시 맞춘다.
 *    → 키오스크를 껐다 켜거나 F5를 해도 정지 시간이 이어진다.
 * 2. 설비를 바꾸면 그 설비의 진행중 정지/호출을 다시 복원한다.
 * 3. 정지 중 여부(isStopped)는 실적입력 차단 조건으로 쓴다.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';
import { getTodayLocal } from '@/utils/date';

const POLL_INTERVAL_MS = 10_000;

export interface EquipStopEvent {
  stopId: number;
  equipCode: string;
  jobOrderNo: string | null;
  stopReason: string | null;
  stopRemark: string | null;
  status: 'OPEN' | 'CLOSED';
  startedAt: string;
  startedBy: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseRemark: string | null;
  lossSeconds: number;
}

export interface EquipCallEvent {
  callId: number;
  equipCode: string;
  jobOrderNo: string | null;
  callType: string;
  callRemark: string | null;
  status: 'OPEN' | 'ACKED';
  calledAt: string;
  calledBy: string | null;
  ackedAt: string | null;
  ackedBy: string | null;
  ackRemark: string | null;
  elapsedSeconds: number;
}

export interface EquipStopSummary {
  stopCount: number;
  totalLossSeconds: number;
  openCount: number;
}

/** 초를 HH:MM:SS 로 */
export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

/** 초를 "1시간 23분" 형태로 (집계 표시용) */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(safe % 60).padStart(2, '0')}s`;
}

/** 서버 경과초 + 로컬 경과분을 합쳐 흐르는 초를 만든다 */
function useTickingSeconds(baseSeconds: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  const baselineRef = useRef<{ seconds: number; at: number } | null>(null);

  useEffect(() => {
    baselineRef.current = baseSeconds === null ? null : { seconds: baseSeconds, at: Date.now() };
    setNow(Date.now());
  }, [baseSeconds]);

  useEffect(() => {
    if (baseSeconds === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [baseSeconds]);

  const baseline = baselineRef.current;
  if (!baseline) return 0;
  return baseline.seconds + Math.floor((now - baseline.at) / 1000);
}

export function useEquipStop(equipCode?: string | null, jobOrderNo?: string | null) {
  const [openStop, setOpenStop] = useState<EquipStopEvent | null>(null);
  const [openCall, setOpenCall] = useState<EquipCallEvent | null>(null);
  const [history, setHistory] = useState<EquipStopEvent[]>([]);
  const [summary, setSummary] = useState<EquipStopSummary>({ stopCount: 0, totalLossSeconds: 0, openCount: 0 });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!equipCode) {
      setOpenStop(null);
      setOpenCall(null);
      setHistory([]);
      setSummary({ stopCount: 0, totalLossSeconds: 0, openCount: 0 });
      return;
    }
    try {
      const [stopRes, callRes] = await Promise.all([
        api.get('/equipment/stop/open', { params: { equipCode } }),
        api.get('/equipment/call/open', { params: { equipCode } }),
      ]);
      setOpenStop(stopRes.data?.data ?? null);
      setOpenCall(callRes.data?.data ?? null);
    } catch {
      // 폴링 실패는 화면을 깨뜨리지 않는다. 다음 주기에 다시 맞춘다.
    }
  }, [equipCode]);

  /** 당일 정지 이력 + 유실시간 집계 (날짜 기본값은 당일) */
  const refreshHistory = useCallback(async (from?: string, to?: string) => {
    if (!equipCode) return;
    const today = getTodayLocal();
    try {
      const res = await api.get('/equipment/stop', {
        params: { equipCode, from: from ?? today, to: to ?? today },
      });
      setHistory(res.data?.data ?? []);
      setSummary(res.data?.summary ?? { stopCount: 0, totalLossSeconds: 0, openCount: 0 });
    } catch {
      setHistory([]);
    }
  }, [equipCode]);

  useEffect(() => {
    void refresh();
    if (!equipCode) return;
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [equipCode, refresh]);

  const startStop = useCallback(async (stopReason?: string, stopRemark?: string) => {
    if (!equipCode) return;
    setLoading(true);
    try {
      const res = await api.post('/equipment/stop', {
        equipCode,
        jobOrderNo: jobOrderNo ?? undefined,
        stopReason: stopReason || undefined,
        stopRemark: stopRemark || undefined,
      });
      setOpenStop(res.data?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [equipCode, jobOrderNo]);

  const updateReason = useCallback(async (stopId: number, stopReason: string, stopRemark?: string) => {
    setLoading(true);
    try {
      const res = await api.patch(`/equipment/stop/${stopId}/reason`, {
        stopReason,
        stopRemark: stopRemark || undefined,
      });
      setOpenStop(res.data?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const releaseStop = useCallback(async (stopId: number, stopReason?: string, releaseRemark?: string) => {
    setLoading(true);
    try {
      await api.post(`/equipment/stop/${stopId}/release`, {
        stopReason: stopReason || undefined,
        releaseRemark: releaseRemark || undefined,
      });
      setOpenStop(null);
      await refreshHistory();
    } finally {
      setLoading(false);
    }
  }, [refreshHistory]);

  const createCall = useCallback(async (callType: string, callRemark?: string) => {
    if (!equipCode) return;
    setLoading(true);
    try {
      const res = await api.post('/equipment/call', {
        equipCode,
        jobOrderNo: jobOrderNo ?? undefined,
        callType,
        callRemark: callRemark || undefined,
      });
      setOpenCall(res.data?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [equipCode, jobOrderNo]);

  const ackCall = useCallback(async (callId: number, ackRemark?: string) => {
    setLoading(true);
    try {
      await api.post(`/equipment/call/${callId}/ack`, { ackRemark: ackRemark || undefined });
      setOpenCall(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const stopElapsed = useTickingSeconds(openStop ? openStop.lossSeconds : null);
  const callElapsed = useTickingSeconds(openCall ? openCall.elapsedSeconds : null);

  return {
    openStop,
    openCall,
    isStopped: Boolean(openStop),
    isCalling: Boolean(openCall),
    stopElapsed,
    callElapsed,
    history,
    summary,
    loading,
    refresh,
    refreshHistory,
    startStop,
    updateReason,
    releaseStop,
    createCall,
    ackCall,
  };
}
