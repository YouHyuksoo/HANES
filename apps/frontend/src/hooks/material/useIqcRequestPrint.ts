/**
 * @file src/hooks/material/useIqcRequestPrint.ts
 * @description IQC 검사의뢰서 출력 대상 관리 훅 — 입하 화면(본 발행)과 수입검사 화면(재발행)이 공유한다.
 *
 * 초보자 가이드:
 * 1. openFor([{ arrivalNo, itemCode }]) → 의뢰서 모달이 열린다(여러 그룹이면 장 단위로 연속 출력).
 * 2. lookupByBarcode(barcode) → 자재 시리얼/입하번호/PO번호 바코드를 서버에서 입하 그룹으로 해석해 openFor.
 *    검사 상태와 무관하다(검사 완료 후 재발행 가능).
 * 3. 해석 결과가 없으면 토스트로 안내하고 모달은 열지 않는다.
 */
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';

/** 의뢰서 1장 = 입하번호 + 품목 그룹. iqcStatus를 알면 머리 정보 조회에 쓰고, 모르면 모달이 서버에서 해석한다. */
export interface IqcRequestTarget {
  arrivalNo: string;
  itemCode: string;
  iqcStatus?: string | null;
}

export function useIqcRequestPrint() {
  const { t } = useTranslation();
  const [targets, setTargets] = useState<IqcRequestTarget[]>([]);

  const openFor = useCallback((next: IqcRequestTarget[]) => {
    setTargets(next.filter((x) => x.arrivalNo && x.itemCode));
  }, []);
  const close = useCallback(() => setTargets([]), []);

  const lookupByBarcode = useCallback(async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;
    try {
      const res = await api.get('/material/iqc-history/request-lookup', { params: { barcode: code } });
      const groups: IqcRequestTarget[] = res.data?.data?.groups ?? [];
      if (groups.length === 0) {
        toast.error(t('material.iqc.request.lookupNotFound', '입하 건을 찾을 수 없습니다: {{barcode}}', { barcode: code }));
        return;
      }
      setTargets(groups);
    } catch {
      toast.error(t('material.iqc.request.lookupFailed', '바코드 조회에 실패했습니다.'));
    }
  }, [t]);

  return { targets, isOpen: targets.length > 0, openFor, close, lookupByBarcode };
}
