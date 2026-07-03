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
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Save, ChevronDown } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore, buildSerialNo } from '@/stores/kioskStore';
import { formatQty, parseQty } from '@/utils/qty';

interface ProductionInputBarProps {
  onSaved: () => void;
  /** 실적 저장 성공 후 생성된 생산실적번호 전달 — SFG 라벨 자동 출력 등 후처리에 사용 */
  onResultSaved?: (resultNo: string) => void;
  /** 준비단계 인터락 모두 완료 여부 — false면 실적입력 비활성화 */
  interlockDone?: boolean;
  disabledReasons?: string[];
  productionType: 'TRIAL' | 'MASS';
}

const LOT_OPTIONS = [1, 5, 10, 20, 50, 100];

export default function ProductionInputBar({
  onSaved,
  onResultSaved,
  interlockDone = true,
  disabledReasons = [],
  productionType,
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

  // 묶음단위(lotSize)는 품목마스터의 LOT_UNIT_QTY(묶음단위수량)를 출처로 한다.
  // 작업지시 선택 시 해당 품목의 묶음단위수량을 조회해 기본값으로 설정(0/미설정이면 유지).
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

  const serialNo = selectedJobOrder
    ? buildSerialNo(selectedJobOrder.orderNo, serialSeq)
    : '';

  const canSave = !!(selectedEquip && selectedJobOrder && selectedWorkers.length > 0 && interlockDone);
  const isMassProduction = productionType === 'MASS';
  const productionTypeLabel = isMassProduction ? '양산' : '시생산';
  const productionTypeHint = isMassProduction
    ? '초물 합격 완료. 이후 실적은 양산으로 저장됩니다.'
    : '초물 합격 전까지 시생산으로 저장됩니다.';

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
    const good = parseQty(goodQty);
    // pendingDefects 합계가 있으면 우선, 없으면 defectQty 직접 입력값 사용
    const pendingDefectTotal = pendingDefects.reduce((s, d) => s + d.qty, 0);
    const defect = pendingDefectTotal > 0 ? pendingDefectTotal : parseQty(defectQty);
    if (good + defect === 0) {
      toast.error(t('kiosk.input.qtyRequired'));
      return;
    }
    setSaving(true);
    try {
      // 불량 상세는 생산실적 생성과 같은 트랜잭션에서 저장된다(별도 defect-logs 호출 시 defectQty 이중 카운트되던 결함 해소).
      const res = await api.post('/production/prod-results', {
        orderNo: selectedJobOrder!.orderNo,
        equipCode: selectedEquip!.equipCode,
        workerId: selectedWorkers[0].id,
        // 공정은 선택 설비에서 도출(설비→공정, 3화면 통일). 작업지시 processCode 고정 대신.
        processCode: selectedEquip?.processCode,
        prdUid: serialNo || undefined,
        goodQty: good,
        defectQty: defect,
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
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.input.saveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [canSave, goodQty, defectQty, pendingDefects, selectedJobOrder, selectedEquip,
      selectedWorkers, serialNo, incrementSerial, clearPendingDefects, onSaved, onResultSaved, t]);

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
                {lotOptions.map(n => (
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

          <div className="flex flex-col gap-1 shrink-0 min-w-[92px]" title={productionTypeHint}>
            <span className="text-xs text-text-muted">생산유형</span>
            <div className={`h-8 px-2 rounded border flex items-center justify-center text-xs font-bold ${
              isMassProduction
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
            }`}>
              {productionTypeLabel}
            </div>
          </div>

          {/* 수량 입력 3칸 */}
          <div className="grid w-full grid-cols-3 gap-1.5 shrink-0">
            {/* 작업수 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-text-muted text-center">{t('kiosk.input.totalQty')}</span>
              <input
                type="text"
                inputMode="numeric"
                value={totalQty === '' ? '' : formatQty(parseQty(totalQty))}
                onChange={e => handleTotalChange(e.target.value)}
                placeholder="0"
                className="h-8 w-full text-center text-base font-bold bg-surface border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {/* 양품 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-green-600 dark:text-green-400 text-center">{t('kiosk.input.goodQty')}</span>
              <input
                type="text"
                inputMode="numeric"
                value={goodQty === '' ? '' : formatQty(parseQty(goodQty))}
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
                  type="text"
                  inputMode="numeric"
                  value={defectQty === '' ? '' : formatQty(parseQty(defectQty))}
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
