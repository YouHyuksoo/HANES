"use client";

/**
 * @file components/EquipHeader.tsx
 * @description 키오스크 상단 헤더 — 설비·작업지시·작업자 선택 및 현황 표시
 *
 * 초보자 가이드:
 * - 설비 선택: 버튼 클릭 → EquipSelectModal (바코드 스캔 또는 목록 클릭)
 * - 작업지시: 설비 선택 후 클릭하여 모달에서 선택
 * - 작업자: 바코드 스캔 또는 모달에서 선택 (다중 등록 가능)
 */
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Barcode,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Cpu,
  Maximize2,
  Minimize2,
  UserPlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import EquipSelectModal from './EquipSelectModal';
import type { BomItem } from './MaterialListPanel';

interface EquipOption { equipCode: string; equipName: string; }

interface EquipHeaderProps {
  equips: EquipOption[];
  onOpenJobOrder: () => void;
  onOpenWorker: () => void;
}

export default function EquipHeader({ equips, onOpenJobOrder, onOpenWorker }: EquipHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    selectedEquip, selectedJobOrder, selectedWorkers,
    setSelectedEquip, removeWorker,
    addScannedMaterialLot, setInterlock,
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
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
        {
          matUid: value,
          bomItems: bomItems.map(b => ({ itemCode: b.childItemCode, seq: b.seq })),
        },
      );
      const lot = res.data?.data as { itemCode: string; seq: number; matUid: string; initQty: number };
      addScannedMaterialLot({ itemCode: lot.itemCode, seq: lot.seq, matUid: lot.matUid, initQty: lot.initQty });
      toast.success(t('kiosk.material.scanOk'));

      // 모든 BOM 항목 스캔 완료 시 인터락 해제
      const currentLots = useKioskStore.getState().scannedMaterialLots;
      const allDone = bomItems.every(b =>
        currentLots.some(l => l.itemCode === b.childItemCode && l.seq === b.seq)
      );
      if (allDone) {
        setInterlock('materialScanDone', true);
        toast.success(t('kiosk.material.allLotScanned'));
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg?.includes('오장착')) {
        toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
      } else if (msg?.includes('LOT를 찾을 수 없습니다')) {
        toast.error(t('kiosk.material.lotNotFound'));
      }
      // 그 외 바코드(소모품, 작업자 등)는 조용히 무시
    }
  }, [barcodeValue, selectedJobOrder, bomItems, addScannedMaterialLot, setInterlock, t]);

  const handleToggleWorkView = useCallback(() => {
    if (isWorkView) {
      router.push('/production/input-kiosk');
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
      return;
    }
    router.push('/production/input-kiosk?view=work');
    void document.documentElement.requestFullscreen();
  }, [isWorkView, router]);

  const progress = selectedJobOrder
    ? Math.min(Math.round((selectedJobOrder.completedQty / selectedJobOrder.planQty) * 100), 100)
    : 0;

  return (
    <>
      <div className="bg-card border-b border-border flex-shrink-0">
        {/* 상단 바: 설비 선택 + 점검 버튼 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-surface/50">
          <Cpu className="w-5 h-5 text-primary shrink-0" />

          {/* 설비 선택 버튼 */}
          <button
            onClick={() => setIsEquipModalOpen(true)}
            className={`flex items-center gap-2 px-3 h-9 rounded-lg border-2 text-sm font-semibold transition-colors min-w-[200px] ${
              selectedEquip
                ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
                : 'border-dashed border-border text-text-muted hover:border-primary hover:text-primary'
            }`}
          >
            <Cpu className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left truncate">
              {selectedEquip
                ? `${selectedEquip.equipName} (${selectedEquip.equipCode})`
                : t('kiosk.header.selectEquip')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
          </button>

          <div className="flex min-w-[320px] max-w-xl flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBarcodeSubmit();
                }}
                placeholder={t(
                  'kiosk.header.barcodePlaceholder',
                  '바코드 정보 (자재, 소모성 설비부품, 묶음 시리얼 등...)',
                )}
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleBarcodeSubmit}
              disabled={!barcodeValue.trim()}
              className="h-9 px-4 text-xs font-semibold"
            >
              {t('common.input', '입력')}
            </Button>
          </div>

          {/* 점검 버튼 */}
          <Button variant="outline" size="sm" disabled={!selectedEquip}
            className="text-orange-600 border-orange-300 dark:border-orange-700 text-xs">
            {t('kiosk.header.dailyInspect')}
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedEquip}
            className="text-blue-600 border-blue-300 dark:border-blue-700 text-xs">
            {t('kiosk.header.workerInspect')}
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedEquip}
            className="text-purple-600 border-purple-300 dark:border-purple-700 text-xs">
            {t('kiosk.header.masterSample')}
          </Button>

          <button
            type="button"
            onClick={handleToggleWorkView}
            title={
              isWorkView
                ? t('kiosk.header.menuView', '메뉴 화면으로')
                : t('kiosk.header.workView', '작업 전체화면')
            }
            aria-label={
              isWorkView
                ? t('kiosk.header.menuView', '메뉴 화면으로')
                : t('kiosk.header.workView', '작업 전체화면')
            }
            className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {isWorkView || isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* 하단 바: 작업지시 + 작업자 + 진행률 */}
        <div className="flex items-stretch gap-0 px-4 py-2 min-h-[72px]">
          {/* 작업지시 영역 */}
          <div className="flex-1 flex items-center gap-3 pr-4 border-r border-border/50">
            <ClipboardList className="w-4 h-4 text-primary shrink-0" />
            {selectedJobOrder ? (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-text font-mono truncate">
                    {selectedJobOrder.orderNo}
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                    {selectedJobOrder.processType}
                  </span>
                </div>
                <p className="text-xs text-text-muted truncate">{selectedJobOrder.itemName}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 bg-surface rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs text-text-muted shrink-0 font-medium">
                    {selectedJobOrder.completedQty.toLocaleString()} / {selectedJobOrder.planQty.toLocaleString()} EA
                    <span className="ml-1 text-primary">({progress}%)</span>
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => selectedEquip && onOpenJobOrder()}
                disabled={!selectedEquip}
                className="flex items-center gap-1.5 text-sm text-text-muted hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                {t('kiosk.header.selectJobOrder')}
              </button>
            )}
            {selectedJobOrder && (
              <button onClick={onOpenJobOrder}
                className="text-xs text-primary hover:underline shrink-0">
                {t('common.change')}
              </button>
            )}
          </div>

          {/* 작업자 영역 */}
          <div className="flex items-center gap-2 pl-4">
            <UserPlus className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-wrap gap-1.5 max-w-xs">
              {selectedWorkers.map(w => (
                <span key={w.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  {w.workerName}
                  <button onClick={() => removeWorker(w.id)}
                    className="hover:text-red-500 transition-colors ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={onOpenWorker}
                disabled={!selectedEquip}
                className="inline-flex items-center gap-1 px-2 py-0.5 border border-dashed border-border rounded-full text-xs text-text-muted hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <UserPlus className="w-3 h-3" />
                {t('kiosk.header.addWorker')}
              </button>
            </div>
            {selectedWorkers.length === 0 && selectedEquip && (
              <span className="text-xs text-orange-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {t('kiosk.header.workerRequired')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 설비 선택 모달 */}
      <EquipSelectModal
        isOpen={isEquipModalOpen}
        onClose={() => setIsEquipModalOpen(false)}
        equips={equips}
        onSelect={handleEquipSelect}
      />
    </>
  );
}
