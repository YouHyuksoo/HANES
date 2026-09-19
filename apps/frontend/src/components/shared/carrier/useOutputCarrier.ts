"use client";
/**
 * @file components/shared/carrier/useOutputCarrier.ts
 * @description 출력 대차 슬롯 상태 훅 — 공정 플래그 조회, 대차 스캔(select), 해제, 재조회.
 *
 * 초보자 가이드:
 * 1. enabled(=공정 CARRIER_LOAD_YN 'Y')가 아니면 아무것도 하지 않는다. 화면은 state.enabled로 슬롯을 숨긴다.
 * 2. 설비의 CUR_CARRIER_NO(initialCarrierNo)가 있으면 진입 시 상태를 불러와 복원한다.
 * 3. 실적 저장이 "대차 교체" 400을 받으면 onCapacityRejected()로 슬롯을 비운다.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "@/services/api";
import type { CarrierProcessFlags, CarrierStatusView } from "./carrierTypes";

export function useCarrierProcessFlags(input: { orderNo: string | null | undefined; processCode: string | null | undefined }): CarrierProcessFlags | null {
  const { orderNo, processCode } = input;
  const [flags, setFlags] = useState<CarrierProcessFlags | null>(null);
  useEffect(() => {
    if (!orderNo || !processCode) { setFlags(null); return; }
    let alive = true;
    api.get("/production/carriers/process-flags", { params: { orderNo, processCode }, suppressErrorModal: true })
      .then((res) => { if (alive) setFlags(res.data?.data ?? null); })
      .catch(() => { if (alive) setFlags(null); });
    return () => { alive = false; };
  }, [orderNo, processCode]);
  return flags;
}

export interface OutputCarrierState {
  enabled: boolean;
  carrier: CarrierStatusView | null;
  loading: boolean;
  scan: (no: string) => Promise<boolean>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  onCapacityRejected: () => void;
}

export function useOutputCarrier(input: {
  equipCode: string | null | undefined;
  enabled: boolean;
  initialCarrierNo?: string | null;
}): OutputCarrierState {
  const { equipCode, enabled, initialCarrierNo } = input;
  const { t } = useTranslation();
  const [carrier, setCarrier] = useState<CarrierStatusView | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!carrier?.carrierNo) return;
    try {
      const res = await api.get(`/production/carriers/${encodeURIComponent(carrier.carrierNo)}`, { suppressErrorModal: true });
      setCarrier(res.data?.data ?? null);
    } catch { /* 공통 API 레이어 처리 */ }
  }, [carrier?.carrierNo]);

  // 설비 재진입 복원 — CUR_CARRIER_NO가 있으면 상태를 불러온다(전표 발행돼 이미 풀린 대차면 서버가 NULL을 준다)
  useEffect(() => {
    if (!enabled || !initialCarrierNo) { setCarrier(null); return; }
    let alive = true;
    api.get(`/production/carriers/${encodeURIComponent(initialCarrierNo)}`, { suppressErrorModal: true })
      .then((res) => { if (alive) setCarrier(res.data?.data ?? null); })
      .catch(() => { if (alive) setCarrier(null); });
    return () => { alive = false; };
  }, [enabled, initialCarrierNo]);

  const scan = useCallback(async (no: string) => {
    const trimmed = no.trim();
    if (!trimmed || !equipCode) return false;
    setLoading(true);
    try {
      const res = await api.post(`/production/carriers/${encodeURIComponent(trimmed)}/select`, { equipCode }, { skipSuccessToast: true });
      setCarrier(res.data?.data ?? null);
      return true;
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (message) toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [equipCode]);

  const clear = useCallback(async () => {
    if (equipCode) {
      await api.post("/production/carriers/release", { equipCode }, { skipSuccessToast: true, suppressErrorModal: true }).catch(() => undefined);
    }
    setCarrier(null);
  }, [equipCode]);

  const onCapacityRejected = useCallback(() => {
    toast.error(t("carrier.capacityFull", "대차가 가득 찼습니다. 다른 대차를 스캔하세요."));
    setCarrier(null);
  }, [t]);

  return { enabled, carrier, loading, scan, clear, refresh, onCapacityRejected };
}
