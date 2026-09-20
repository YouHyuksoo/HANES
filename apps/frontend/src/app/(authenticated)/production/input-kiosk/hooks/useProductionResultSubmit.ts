"use client";

/**
 * @file hooks/useProductionResultSubmit.ts
 * @description 실적입력 폼 상태(묶음단위·시리얼·작업수/양품/불량) + 실적 저장(POST /production/prod-results)
 *
 * 초보자 가이드:
 * - ProductionInputBar 안에 있던 입력 상태와 저장 로직을 훅으로 뽑았다. 기존 가로형 입력 바(ProductionInputBar)와
 *   B 배치의 세로형 입력 영역(KioskResultEntry)이 같은 훅을 써서 저장 규칙이 갈라지지 않는다.
 * - 불량 상세(pendingDefects)는 생산실적 생성과 같은 트랜잭션으로 보낸다(별도 defect-logs 호출 시 이중 카운트되던 결함 해소).
 * - 양품은 전송 시점에 작업수 - 불량으로 재계산한다(불량입력 패널 등록분이 goodQty state 에 안 반영되던 결함 해소).
 * - 묶음단위(lotSize)는 품목마스터 LOT_UNIT_QTY 를 출처로 한다. 작업지시 선택 시 기본값으로 설정(0/미설정이면 유지).
 */
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useKioskStore, buildSerialNo } from '@/stores/kioskStore';
import { parseQty } from '@/utils/qty';

const LOT_OPTIONS = [1, 5, 10, 20, 50, 100];

export interface ProductionResultSubmitInput {
  onSaved: () => void;
  /** 실적 저장 성공 후 생성된 생산실적번호 전달 — SFG 라벨 자동 출력 등 후처리에 사용 */
  onResultSaved?: (resultNo: string) => void;
  /** 준비단계 인터락 모두 완료 여부 — false면 저장 불가 */
  interlockDone?: boolean;
  disabledReasons?: string[];
  /** 출력 대차 번호 — 실적 저장 요청에 실려 대차에 라벨을 적재한다 */
  outputCarrierNo: string | null;
  /** 대차 용량 초과(400 "대차 교체")를 받았을 때 슬롯을 비운다 */
  onCapacityRejected: () => void;
}

export function useProductionResultSubmit({
  onSaved, onResultSaved, interlockDone = true, disabledReasons = [], outputCarrierNo, onCapacityRejected,
}: ProductionResultSubmitInput) {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder, selectedWorkers,
    lotSize, serialSeq, pendingDefects,
    setLotSize, incrementSerial, clearPendingDefects,
  } = useKioskStore();

  const [goodQty, setGoodQty] = useState<string>('');
  const [defectQty, setDefectQty] = useState<string>('');
  const [totalQty, setTotalQty] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const selectedItemCode = selectedJobOrder?.itemCode;
  useEffect(() => {
    if (!selectedItemCode) return;
    api.get(`/master/parts/code/${encodeURIComponent(selectedItemCode)}`)
      .then(res => {
        const q = Number(res.data?.data?.lotUnitQty);
        if (Number.isFinite(q) && q > 0) setLotSize(q);
      })
      .catch(() => { /* 품목 조회 실패 시 기존 묶음단위 유지 */ });
  }, [selectedItemCode, setLotSize]);

  // 드롭다운에 품목 묶음단위(비표준 값)도 항상 표시되도록 표준 목록과 병합
  const lotOptions = Array.from(new Set([...LOT_OPTIONS, lotSize].filter(n => n > 0))).sort((a, b) => a - b);

  // pendingDefects 수량 합계 → 불량수량 표시에 반영
  const pendingDefectTotal = pendingDefects.reduce((s, d) => s + d.qty, 0);

  const serialNo = selectedJobOrder ? buildSerialNo(selectedJobOrder.orderNo, serialSeq) : '';

  const canSave = !!(selectedEquip && selectedJobOrder && selectedWorkers.length > 0 && interlockDone);

  const buttonTitle = (() => {
    if (saving) return t('common.saving');
    if (canSave) return t('kiosk.input.submit');
    if (disabledReasons.length === 0) return t('kiosk.input.disabledHint');
    return `${t('kiosk.input.disabledHint')}\n${disabledReasons.map(r => `• ${r}`).join('\n')}`;
  })();

  const handleTotalChange = useCallback((val: string) => {
    setTotalQty(val);
    const total = parseQty(val);
    const defect = parseQty(defectQty);
    setGoodQty(String(Math.max(0, total - defect)));
  }, [defectQty]);

  const handleDefectChange = useCallback((val: string) => {
    setDefectQty(val);
    const total = parseQty(totalQty);
    const defect = parseQty(val);
    setGoodQty(String(Math.max(0, total - defect)));
  }, [totalQty]);

  const handleSubmit = useCallback(async () => {
    if (!canSave) return;
    // pendingDefects 합계가 있으면 우선, 없으면 defectQty 직접 입력값 사용
    const pendingTotal = pendingDefects.reduce((s, d) => s + d.qty, 0);
    const defect = pendingTotal > 0 ? pendingTotal : parseQty(defectQty);
    const total = parseQty(totalQty);
    const good = total > 0 ? Math.max(0, total - defect) : parseQty(goodQty);
    if (good + defect === 0) {
      toast.error(t('kiosk.input.qtyRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/production/prod-results', {
        orderNo: selectedJobOrder!.orderNo,
        equipCode: selectedEquip!.equipCode,
        workerId: selectedWorkers[0].id,
        // 공정은 선택 설비에서 도출(설비→공정, 3화면 통일). 작업지시 processCode 고정 대신.
        processCode: selectedEquip?.processCode,
        prdUid: serialNo || undefined,
        goodQty: good,
        defectQty: defect,
        carrierNo: outputCarrierNo ?? undefined,
        ...(pendingDefects.length > 0 && {
          defects: pendingDefects.map(d => ({
            defectCode: d.defectCode,
            defectName: d.defectName,
            qty: d.qty,
          })),
        }),
      }, { skipSuccessToast: true });

      toast.success(t('kiosk.input.saveSuccess'));
      incrementSerial();
      clearPendingDefects();
      setTotalQty('');
      setGoodQty('');
      setDefectQty('');
      onSaved();

      // 발행공정이면 백엔드가 SFG 라벨(SG_LABELS)을 발행한다 → 발행분을 조회해 라벨 출력(발행 없으면 무동작).
      const savedResultNo = (res?.data?.data?.resultNo ?? '') as string;
      if (savedResultNo) onResultSaved?.(savedResultNo);
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
      if (message.startsWith("대차 교체")) {
        // 대차 용량 초과 안내는 onCapacityRejected가 자체 토스트로 띄운다(중복 토스트 방지).
        onCapacityRejected();
      } else {
        toast.error(message || t('kiosk.input.saveError'));
      }
    } finally {
      setSaving(false);
    }
  }, [canSave, goodQty, defectQty, totalQty, pendingDefects, selectedJobOrder, selectedEquip,
      selectedWorkers, serialNo, incrementSerial, clearPendingDefects, onSaved, onResultSaved, t,
      outputCarrierNo, onCapacityRejected]);

  return {
    totalQty, goodQty, defectQty, handleTotalChange, handleDefectChange,
    lotSize, setLotSize, lotOptions, serialNo,
    pendingDefects, pendingDefectTotal,
    canSave, saving, buttonTitle, handleSubmit,
  };
}
