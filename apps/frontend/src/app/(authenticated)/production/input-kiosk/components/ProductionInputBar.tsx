"use client";

/**
 * @file components/ProductionInputBar.tsx
 * @description 하단 실적입력 바 — 묶음단위·시리얼·수량 입력 + 실적저장
 *
 * 초보자 가이드:
 * - 불량입력: DefectInputModal로 불량유형/수량 등록 → pendingDefects에 임시 보관
 * - 실적저장: POST /production/prod-results → 성공 시 defect-logs API로 불량 저장
 * - 시리얼 번호: {orderNo}-{seq 3자리} 형식 자동 생성
 * - 저장 성공 시 serialSeq 자동 증가, pendingDefects 초기화
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Save, ChevronDown } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore, buildSerialNo } from '@/stores/kioskStore';

interface ProductionInputBarProps {
  onSaved: () => void;
  /** 준비단계 인터락 모두 완료 여부 — false면 실적입력 비활성화 */
  interlockDone?: boolean;
  disabledReasons?: string[];
}

const LOT_OPTIONS = [1, 5, 10, 20, 50, 100];

export default function ProductionInputBar({
  onSaved,
  interlockDone = true,
  disabledReasons = [],
}: ProductionInputBarProps) {
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

  // pendingDefects 수량 합계 → 불량수량 표시에 반영
  const pendingDefectTotal = pendingDefects.reduce((s, d) => s + d.qty, 0);

  const serialNo = selectedJobOrder
    ? buildSerialNo(selectedJobOrder.orderNo, serialSeq)
    : '';

  const canSave = !!(selectedEquip && selectedJobOrder && selectedWorkers.length > 0 && interlockDone);

  const buttonTitle = (() => {
    if (saving) return t('common.saving');
    if (canSave) return t('kiosk.input.submit');
    if (disabledReasons.length === 0) return t('kiosk.input.disabledHint');
    return `${t('kiosk.input.disabledHint')}\n${disabledReasons.map(r => `• ${r}`).join('\n')}`;
  })();

  const handleTotalChange = useCallback((val: string) => {
    setTotalQty(val);
    const total = Number(val) || 0;
    const defect = Number(defectQty) || 0;
    setGoodQty(String(Math.max(0, total - defect)));
  }, [defectQty]);

  const handleDefectChange = useCallback((val: string) => {
    setDefectQty(val);
    const total = Number(totalQty) || 0;
    const defect = Number(val) || 0;
    setGoodQty(String(Math.max(0, total - defect)));
  }, [totalQty]);

  const handleSubmit = useCallback(async () => {
    if (!canSave) return;
    const good = Number(goodQty) || 0;
    // pendingDefects 합계가 있으면 우선, 없으면 defectQty 직접 입력값 사용
    const pendingDefectTotal = pendingDefects.reduce((s, d) => s + d.qty, 0);
    const defect = pendingDefectTotal > 0 ? pendingDefectTotal : (Number(defectQty) || 0);
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
        processCode: selectedJobOrder?.processCode,
        prdUid: serialNo || undefined,
        goodQty: good,
        defectQty: defect,
      }, { skipSuccessToast: true });
      const resultNo: string = res.data?.data?.resultNo ?? res.data?.data?.id ?? '';

      // 불량 상세 로그 저장 (pendingDefects가 있는 경우)
      if (resultNo && pendingDefects.length > 0) {
        await Promise.allSettled(
          pendingDefects.map(d =>
            api.post('/quality/defect-logs', {
              prodResultNo: resultNo,
              defectCode: d.defectCode,
              defectName: d.defectName,
              qty: d.qty,
            }, { skipSuccessToast: true })
          )
        );
      }

      toast.success(t('kiosk.input.saveSuccess'));
      incrementSerial();
      clearPendingDefects();
      setTotalQty('');
      setGoodQty('');
      setDefectQty('');
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.input.saveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [canSave, goodQty, defectQty, pendingDefects, selectedJobOrder, selectedEquip,
      selectedWorkers, serialNo, incrementSerial, clearPendingDefects, onSaved, t]);

  return (
    <div className="h-full bg-card flex-shrink-0">
      <div className="flex h-full min-h-[88px] items-stretch gap-0">

        {/* 생산실적 입력 영역 */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center content-center gap-1.5 px-2 py-2">
          {/* 묶음단위 */}
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-xs text-text-muted">{t('kiosk.input.lotSize')}</span>
            <div className="relative">
              <select
                value={lotSize}
                onChange={e => setLotSize(Number(e.target.value))}
                className="h-8 w-14 pl-2 pr-5 text-sm font-medium bg-surface border border-border rounded appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {LOT_OPTIONS.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            </div>
          </div>

          {/* 시리얼 번호 */}
          <div className="flex flex-col gap-1 flex-1 min-w-[86px]">
            <span className="text-xs text-text-muted">SERIAL NO</span>
            <div className="h-8 px-1.5 bg-surface/50 border border-border/50 rounded flex items-center">
              <span className="text-xs font-mono text-text truncate">
                {serialNo || <span className="text-text-muted">{t('kiosk.input.selectJobOrderFirst')}</span>}
              </span>
            </div>
          </div>

          {/* 수량 입력 3칸 */}
          <div className="grid w-full grid-cols-3 gap-1.5 shrink-0">
            {/* 작업수 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-text-muted text-center">{t('kiosk.input.totalQty')}</span>
              <input
                type="number"
                min="0"
                value={totalQty}
                onChange={e => handleTotalChange(e.target.value)}
                placeholder="0"
                className="h-8 w-full text-center text-base font-bold bg-surface border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {/* 양품 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-green-600 dark:text-green-400 text-center">{t('kiosk.input.goodQty')}</span>
              <input
                type="number"
                min="0"
                value={goodQty}
                readOnly
                placeholder="0"
                className="h-8 w-full text-center text-base font-bold bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded focus:outline-none cursor-default"
              />
            </div>
            {/* 불량 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-red-600 dark:text-red-400 text-center">{t('kiosk.input.defectQty')}</span>
              {pendingDefectTotal > 0 ? (
                /* pendingDefects가 있으면 합계 표시 (읽기 전용) */
                <div className="h-8 w-full flex items-center justify-center text-base font-bold bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded cursor-default">
                  {pendingDefectTotal}
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  value={defectQty}
                  onChange={e => handleDefectChange(e.target.value)}
                  placeholder="0"
                  className="h-8 w-full text-center text-base font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* 실적입력 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSave || saving}
          title={buttonTitle}
          className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 bg-primary px-1 hover:bg-primary/90 disabled:bg-surface disabled:cursor-not-allowed text-white disabled:text-text-muted transition-colors"
        >
          <Save className="w-5 h-5" />
          <span className="text-xs font-bold whitespace-nowrap">
            {saving ? t('common.saving') : t('kiosk.input.submit')}
          </span>
        </button>
      </div>
    </div>
  );
}
