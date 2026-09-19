"use client";
/**
 * @file components/shared/carrier/useCarrierAutoInput.ts
 * @description 후공정 대차 자동투입 훅 — 스캔값이 대차면 담긴 바코드 목록을 받아 화면의 기존 처리기(handleBarcode)를 바코드마다 호출한다.
 *
 * 초보자 가이드:
 * 1. 새 투입 경로를 만들지 않는다. 화면이 낱개 스캔에 쓰는 함수를 그대로 넘긴다(가공=설비 장착, 서브조립·조립=SG 목록 추가).
 * 2. 라벨/LOT 접두어(SG/FG/VH1-RM)면 대차 조회를 건너뛰어 낱개 스캔에 지연을 주지 않는다.
 * 3. 서버가 옵션 N·빈 대차·전표 미발행을 400으로 거르고, 화면은 메시지를 토스트로 보여준다.
 */
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "@/services/api";
import type { CarrierContentRow } from "./carrierTypes";

export function isLikelyLabelBarcode(raw: string): boolean {
  const v = raw.trim();
  return /^(SG|FG)\d/i.test(v) || /^VH1-RM/i.test(v);
}

export function useCarrierAutoInput(input: {
  equipCode: string | null | undefined;
  enabled: boolean;
  handleBarcode: (barcode: string) => Promise<boolean>;
}) {
  const { equipCode, enabled, handleBarcode } = input;
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);

  const isCarrierCandidate = useCallback((raw: string) => enabled && !!equipCode && !isLikelyLabelBarcode(raw), [enabled, equipCode]);

  /** @returns handled=false면 대차가 아니므로 호출자가 낱개 스캔으로 이어간다 */
  const run = useCallback(async (raw: string): Promise<{ handled: boolean; ok: number; fail: number }> => {
    const no = raw.trim();
    if (!isCarrierCandidate(no)) return { handled: false, ok: 0, fail: 0 };
    setRunning(true);
    try {
      const res = await api.get(`/production/carriers/${encodeURIComponent(no)}/auto-input`, { params: { equipCode }, suppressErrorModal: true });
      const rows: CarrierContentRow[] = res.data?.data?.rows ?? [];
      let ok = 0;
      let fail = 0;
      for (const row of rows) {
        const done = await handleBarcode(row.barcode);
        if (done) ok += 1; else fail += 1;
      }
      if (fail === 0) toast.success(t("carrier.autoInputDone", "대차 {{no}}: {{ok}}건 투입", { no, ok }));
      else toast.error(t("carrier.autoInputFailed", "대차 {{no}}: {{ok}}건 투입, {{fail}}건 실패", { no, ok, fail }));
      return { handled: true, ok, fail };
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 404) return { handled: false, ok: 0, fail: 0 };
      toast.error(message ?? t("carrier.notCarrier", "대차를 처리할 수 없습니다."));
      return { handled: true, ok: 0, fail: 0 };
    } finally {
      setRunning(false);
    }
  }, [equipCode, handleBarcode, isCarrierCandidate, t]);

  return { isCarrierCandidate, run, running };
}
