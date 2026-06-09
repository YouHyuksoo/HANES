"use client";

/**
 * @file components/EquipHeader.tsx
 * @description 키오스크 상단 헤더 (PAGE 10 2단 구조)
 *
 * 초보자 가이드:
 * - Row1: 설비ID(클릭→선택) / 바코드 입력 / 설비일일검사(상태+입력) / 전체화면 토글
 * - Row2: 작업지시+모델 / 작업자+생산실적 / 작업자설비검사(상태+입력)
 * - 점검 상태는 store interlock 기준, 입력 버튼은 부모(page.tsx) 콜백으로 모달 오픈
 * - 바코드 스캔: 자재 롯트 등록(handleBarcodeSubmit) → 모든 BOM 완료 시 인터락 해제
 */
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, Barcode, ChevronDown, ClipboardList, Cpu,
  Maximize2, Minimize2, UserPlus, X, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import EquipSelectModal from './EquipSelectModal';
import HeaderCheckItem from './HeaderCheckItem';
import type { BomItem } from './MaterialListPanel';

interface EquipOption { equipCode: string; equipName: string; }

interface EquipHeaderProps {
  equips: EquipOption[];
  onOpenJobOrder: () => void;
  onOpenWorker: () => void;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
}

export default function EquipHeader({
  equips, onOpenJobOrder, onOpenWorker, onOpenDailyInspect, onOpenWorkerInspect,
}: EquipHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    selectedEquip, selectedJobOrder, selectedWorkers, interlock,
    setSelectedEquip, removeWorker, addScannedMaterialLot, setInterlock,
  } = useKioskStore();
  const isWorkView = searchParams.get('view') === 'work';
  const [bomItems, setBomItems] = useState<BomItem[]>([]);

  useEffect(() => {
    if (!selectedJobOrder?.itemCode) { setBomItems([]); return; }
    api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
      .then(res => setBomItems(res.data?.data ?? []))
      .catch(() => setBomItems([]));
  }, [selectedJobOrder?.itemCode]);

  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener('fullscreenchange', handle);
    return () => document.removeEventListener('fullscreenchange', handle);
  }, []);

  const handleEquipSelect = useCallback((equip: EquipOption) => {
    setSelectedEquip({ equipCode: equip.equipCode, equipName: equip.equipName });
  }, [setSelectedEquip]);

  const handleBarcodeSubmit = useCallback(async () => {
    const value = barcodeValue.trim();
    if (!value || !selectedJobOrder?.orderNo) { setBarcodeValue(''); return; }
    setBarcodeValue('');
    try {
      const res = await api.post(
        `/production/job-orders/${selectedJobOrder.orderNo}/material-lots/scan`,
        { matUid: value, bomItems: bomItems.map(b => ({ itemCode: b.childItemCode, seq: b.seq })) },
      );
      const lot = res.data?.data as { itemCode: string; seq: number; matUid: string; initQty: number };
      addScannedMaterialLot({ itemCode: lot.itemCode, seq: lot.seq, matUid: lot.matUid, initQty: lot.initQty });
      toast.success(t('kiosk.material.scanOk'));
      const currentLots = useKioskStore.getState().scannedMaterialLots;
      const allDone = bomItems.every(b =>
        currentLots.some(l => l.itemCode === b.childItemCode && l.seq === b.seq));
      if (allDone) {
        setInterlock('materialScanDone', true);
        toast.success(t('kiosk.material.allLotScanned'));
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg?.includes('오장착')) toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
      else if (msg?.includes('LOT를 찾을 수 없습니다')) toast.error(t('kiosk.material.lotNotFound'));
    }
  }, [barcodeValue, selectedJobOrder, bomItems, addScannedMaterialLot, setInterlock, t]);

  const handleToggleWorkView = useCallback(() => {
    if (isWorkView) {
      router.push('/production/input-kiosk');
      if (document.fullscreenElement) void document.exitFullscreen();
      return;
    }
    router.push('/production/input-kiosk?view=work');
    void document.documentElement.requestFullscreen();
  }, [isWorkView, router]);

  const completed = selectedJobOrder?.completedQty ?? 0;
  const planQty = selectedJobOrder?.planQty ?? 0;
  const progress = planQty ? Math.min(Math.round((completed / planQty) * 100), 100) : 0;
  const dailyInspectDisabledReason = !selectedEquip
    ? t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')
    : undefined;
  const workerInspectDisabledReasons = [
    !interlock.dailyInspectDone ? t('kiosk.header.dailyInspectRequired', '설비일일점검을 먼저 완료하세요.') : '',
    selectedWorkers.length === 0 ? t('kiosk.header.workerRequiredForInspect', '작업자를 1명 이상 추가하세요.') : '',
  ].filter(Boolean);
  const workerInspectDisabledReason = workerInspectDisabledReasons.length > 0
    ? workerInspectDisabledReasons.join(' ')
    : undefined;

  return (
    <>
      <div className="flex-shrink-0 border-b border-border bg-card">
        {/* ── Row 1: 설비 / 바코드 / 설비일일검사 / 전체화면 ── */}
        <div className="grid grid-cols-[220px_minmax(0,1fr)_280px_auto] items-center gap-3 border-b border-border/50 bg-surface/50 px-4 py-2">
          <button
            onClick={() => setIsEquipModalOpen(true)}
            className={`flex items-center gap-2 rounded-lg border-2 px-3 h-11 text-left transition-colors ${
              selectedEquip
                ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                : 'border-dashed border-border hover:border-primary'
            }`}
          >
            <Cpu className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              {selectedEquip ? (
                <>
                  <div className="truncate text-sm font-extrabold text-text">{selectedEquip.equipName}</div>
                  <div className="truncate text-[11px] text-text-muted">{selectedEquip.equipCode}</div>
                </>
              ) : (
                <span className="text-sm font-semibold text-text-muted">{t('kiosk.header.selectEquip')}</span>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBarcodeSubmit(); }}
                placeholder={t('kiosk.header.barcodePlaceholder', '바코드 정보 (자재, 소모성 설비부품, 묶음 시리얼 등...)')}
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted dark:placeholder:text-gray-500 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleBarcodeSubmit}
              disabled={!barcodeValue.trim()} className="h-9 px-4 text-xs font-semibold">
              {t('common.input', '입력')}
            </Button>
          </div>

          <HeaderCheckItem
            label={t('kiosk.header.dailyInspect')}
            done={interlock.dailyInspectDone}
            disabled={!selectedEquip}
            disabledReason={dailyInspectDisabledReason}
            onInput={onOpenDailyInspect}
          />

          <button
            type="button"
            onClick={handleToggleWorkView}
            title={isWorkView ? t('kiosk.header.menuView', '메뉴 화면으로') : t('kiosk.header.workView', '작업 전체화면')}
            aria-label={isWorkView ? t('kiosk.header.menuView', '메뉴 화면으로') : t('kiosk.header.workView', '작업 전체화면')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {isWorkView || isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Row 2: 작업지시 / 작업자·생산실적 / 작업자설비검사 ── */}
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_280px] items-stretch gap-3 px-4 py-2">
          {/* 작업지시 */}
          <div className="flex items-center gap-2 border-r border-border/50 pr-3">
            <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
            {selectedJobOrder ? (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-bold text-text">{selectedJobOrder.orderNo}</span>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {selectedJobOrder.processType}
                  </span>
                  <button onClick={onOpenJobOrder} className="shrink-0 text-xs text-primary hover:underline">
                    {t('common.change')}
                  </button>
                </div>
                <p className="mt-0.5 truncate text-xs text-text-muted">{selectedJobOrder.itemName}</p>
              </div>
            ) : (
              <button onClick={() => selectedEquip && onOpenJobOrder()} disabled={!selectedEquip}
                title={selectedEquip ? t('kiosk.header.selectJobOrder') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
                className="flex items-center gap-1.5 text-sm text-text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                <ClipboardList className="h-4 w-4" />
                {t('kiosk.header.selectJobOrder')}
              </button>
            )}
          </div>

          {/* 작업자 + 생산실적 */}
          <div className="flex flex-col justify-center gap-1.5 border-r border-border/50 pr-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <UserPlus className="h-4 w-4 shrink-0 text-primary" />
              {selectedWorkers.map(w => (
                <span key={w.id} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle className="h-3 w-3" />
                  {w.workerName}
                  <button onClick={() => removeWorker(w.id)} className="ml-0.5 transition-colors hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button onClick={onOpenWorker} disabled={!selectedEquip}
                title={selectedEquip ? t('kiosk.header.addWorker') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                <UserPlus className="h-3 w-3" />
                {t('kiosk.header.addWorker')}
              </button>
              {selectedWorkers.length === 0 && selectedEquip && (
                <span className="flex items-center gap-1 text-xs text-orange-500">
                  <AlertTriangle className="h-3 w-3" />
                  {t('kiosk.header.workerRequired')}
                </span>
              )}
            </div>
            {selectedJobOrder && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{t('kiosk.header.prodResult', '생산실적')}</span>
                <span className="text-base font-extrabold tabular-nums text-text">{completed.toLocaleString()}</span>
                <span className="text-xs text-text-muted">/ {planQty.toLocaleString()} EA</span>
                <span className="text-xs font-semibold text-primary">({progress}%)</span>
              </div>
            )}
          </div>

          {/* 작업자설비검사 */}
          <div className="flex items-center [&>*]:w-full">
            <HeaderCheckItem
              label={t('kiosk.header.workerInspect')}
              done={interlock.workerInspectDone}
              disabled={!interlock.dailyInspectDone || selectedWorkers.length === 0}
              disabledReason={workerInspectDisabledReason}
              onInput={onOpenWorkerInspect}
            />
          </div>
        </div>
      </div>

      <EquipSelectModal
        isOpen={isEquipModalOpen}
        onClose={() => setIsEquipModalOpen(false)}
        equips={equips}
        onSelect={handleEquipSelect}
      />
    </>
  );
}
