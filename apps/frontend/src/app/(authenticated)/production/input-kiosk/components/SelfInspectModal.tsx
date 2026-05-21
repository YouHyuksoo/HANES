"use client";

/**
 * @file components/SelfInspectModal.tsx
 * @description 자주검사 모달 (시료 탭 + MEASURE/VISUAL + NG 재검사)
 *
 * 초보자 가이드:
 * - FIRST: sampleCount개 탭 (각 탭 = 시료 1개)
 * - MID/LAST: 탭 1개 (시료 1개)
 * - 측정형(MEASURE): 숫자 입력 → LSL/USL 자동 판정
 * - 판정형(VISUAL): PASS/FAIL 버튼
 * - 종합 FAIL 시 NG 재검사 버튼 표시 → 새 sampleNo로 재저장
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FlaskConical, CheckCircle2, Clock, AlertTriangle, RotateCcw } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore, type InspectTiming } from '@/stores/kioskStore';
import SelfInspectItemRow, {
  type SelfInspectItem,
  type SampleItemResult,
} from './SelfInspectItemRow';

type ResultMap = Record<number, Record<string, SampleItemResult>>;

interface SelfInspectModalProps {
  isOpen: boolean;
  timing: InspectTiming;
  onClose: () => void;
  onDone: () => void;
}

export default function SelfInspectModal({ isOpen, timing, onClose, onDone }: SelfInspectModalProps) {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder, selectedWorkers,
    savedResultCount, setHasPendingDelegate, setMidInspectDone,
  } = useKioskStore();

  const [items, setItems] = useState<SelfInspectItem[]>([]);
  const [results, setResults] = useState<ResultMap>({});
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [reInspectMode, setReInspectMode] = useState(false);
  const [reInspectRound, setReInspectRound] = useState(1);
  const [baseSampleCount, setBaseSampleCount] = useState(1);

  const sampleCount = timing === 'FIRST' ? Math.max(1, items[0]?.sampleCount ?? 1) : 1;

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoading(true);
    setFetchError(false);
    setResults({});
    setActiveTab(0);
    setReInspectMode(false);
    setReInspectRound(1);
    api.get('/production/self-inspect/items', {
      params: {
        processCode: selectedEquip?.processCode ?? selectedJobOrder?.processCode ?? '',
        timing,
      },
      signal: controller.signal,
    })
      .then(res => {
        const data: SelfInspectItem[] = (res.data?.data ?? []).map((i: SelfInspectItem) => ({
          ...i,
          itemType: i.itemType || 'VISUAL',
          sampleCount: i.sampleCount || 1,
        }));
        setItems(data);
        const count = timing === 'FIRST' ? Math.max(1, data[0]?.sampleCount ?? 1) : 1;
        setBaseSampleCount(count);
        const init: ResultMap = {};
        for (let s = 0; s < count; s++) {
          init[s] = {};
        }
        setResults(init);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== 'CanceledError') {
          setItems([]);
          setFetchError(true);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [isOpen, timing, selectedEquip, selectedJobOrder]);

  const handleResultChange = useCallback((sampleIdx: number, itemId: string, next: SampleItemResult) => {
    setResults(prev => ({
      ...prev,
      [sampleIdx]: { ...prev[sampleIdx], [itemId]: next },
    }));
  }, []);

  const isTabComplete = useCallback((sampleIdx: number, targetItems: SelfInspectItem[]) => {
    return targetItems.every(item => {
      const r = results[sampleIdx]?.[item.id]?.result;
      return r !== null && r !== undefined;
    });
  }, [results]);

  const displayItems = reInspectMode
    ? items.filter(item => {
        for (let s = 0; s < baseSampleCount; s++) {
          if (results[s]?.[item.id]?.result === 'FAIL') return true;
        }
        return false;
      })
    : items;

  const allTabsComplete = !reInspectMode
    ? Array.from({ length: sampleCount }, (_, i) => i).every(i => isTabComplete(i, items))
    : isTabComplete(activeTab, displayItems);

  const hasDelegates = items.some(i => i.inspectMethod === 'DELEGATE');

  const timingLabel: Record<InspectTiming, string> = {
    FIRST: t('kiosk.selfInspect.first'),
    MID: t('kiosk.selfInspect.mid'),
    LAST: t('kiosk.selfInspect.last'),
  };

  const handleSubmit = useCallback(async () => {
    if (!allTabsComplete) {
      toast.error(t('kiosk.selfInspect.allSamplesRequired'));
      return;
    }
    setSaving(true);
    try {
      const targetItems = reInspectMode ? displayItems : items;
      const tabCount = reInspectMode ? 1 : sampleCount;
      const sampleNoOffset = reInspectMode ? baseSampleCount * reInspectRound : 0;

      const promises: Promise<unknown>[] = [];
      for (let s = 0; s < tabCount; s++) {
        const sampleNo = s + 1 + sampleNoOffset;
        for (const item of targetItems) {
          const r = results[s]?.[item.id];
          const status = item.inspectMethod === 'DELEGATE' ? 'PENDING' : (r?.result ?? 'PASS');
          promises.push(api.post('/production/self-inspect/results', {
            orderNo: selectedJobOrder?.orderNo,
            equipCode: selectedEquip?.equipCode,
            processCode: selectedEquip?.processCode ?? selectedJobOrder?.processCode,
            inspectItemId: item.id,
            itemName: item.itemName,
            timing,
            inspectMethod: item.inspectMethod,
            status,
            prodQtyAtInspect: savedResultCount,
            inspectorId: selectedWorkers[0]?.id,
            remark: r?.remark,
            sampleNo,
            measureValue: item.itemType === 'MEASURE' && r?.value ? Number(r.value) : undefined,
          }));
        }
      }
      await Promise.all(promises);

      if (hasDelegates && selectedJobOrder) {
        const res = await api.get(`/production/self-inspect/pending/${selectedJobOrder.orderNo}`);
        setHasPendingDelegate(res.data?.data?.hasPending ?? false);
      }

      if (timing === 'MID') setMidInspectDone(true);

      const failItems = targetItems.filter(item => {
        for (let s = 0; s < tabCount; s++) {
          if (results[s]?.[item.id]?.result === 'FAIL') return true;
        }
        return false;
      });

      if (failItems.length > 0) {
        toast.error(t('kiosk.selfInspect.savedWithFail', { count: failItems.length }), { duration: 5000 });
        if (!reInspectMode) {
          setReInspectMode(true);
          setActiveTab(0);
          setResults(prev => ({ ...prev, 0: {} }));
        } else {
          setReInspectRound(prev => prev + 1);
          setResults(prev => ({ ...prev, 0: {} }));
        }
      } else {
        const delegateCount = items.filter(i => i.inspectMethod === 'DELEGATE').length;
        if (delegateCount > 0) {
          toast(t('kiosk.selfInspect.delegatePending', { count: delegateCount }), { icon: '📋', duration: 4000 });
        } else {
          toast.success(t('kiosk.selfInspect.allPass'));
        }
        onDone();
      }
    } catch {
      toast.error(t('kiosk.selfInspect.saveError'));
    } finally {
      setSaving(false);
    }
  }, [allTabsComplete, reInspectMode, displayItems, items, sampleCount, baseSampleCount,
      reInspectRound, results, timing, selectedJobOrder, selectedEquip, selectedWorkers,
      savedResultCount, hasDelegates, setHasPendingDelegate, setMidInspectDone, onDone, t]);

  const title = reInspectMode
    ? t('kiosk.selfInspect.reInspectTitle', { n: reInspectRound })
    : `${timingLabel[timing]} ${t('kiosk.selfInspect.title')}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <FlaskConical className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-blue-700 dark:text-blue-300">{timingLabel[timing]}</span>
            {selectedJobOrder && (
              <span className="ml-2 text-blue-500 font-mono text-xs">{selectedJobOrder.orderNo}</span>
            )}
          </div>
          <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">
            {t('kiosk.selfInspect.resultCount', { count: savedResultCount })}
          </span>
        </div>

        {/* 시료 탭 (FIRST + sampleCount>1인 경우만) */}
        {!reInspectMode && sampleCount > 1 && (
          <div className="flex gap-1 border-b border-border">
            {Array.from({ length: sampleCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === i
                    ? 'bg-primary text-white'
                    : isTabComplete(i, items)
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'text-text-muted hover:bg-surface'
                }`}
              >
                {t('kiosk.selfInspect.sampleTab', { n: i + 1 })}
                {isTabComplete(i, items) && <span className="ml-1 text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* 항목 목록 */}
        {loading ? (
          <div className="py-8 text-center text-text-muted text-sm">{t('common.loading')}</div>
        ) : fetchError ? (
          <div className="py-8 text-center text-red-600 dark:text-red-400 text-sm">{t('kiosk.selfInspect.loadError')}</div>
        ) : displayItems.length === 0 && !reInspectMode ? (
          <div className="py-8 flex flex-col items-center gap-3 text-text-muted">
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <p className="text-sm">{t('kiosk.selfInspect.noItems')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {displayItems.map(item => (
              <SelfInspectItemRow
                key={item.id}
                item={item}
                result={results[activeTab]?.[item.id]}
                onChange={(itemId, next) => handleResultChange(activeTab, itemId, next)}
              />
            ))}
          </div>
        )}

        {/* 의뢰검사 안내 */}
        {hasDelegates && !reInspectMode && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
            <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              {t('kiosk.selfInspect.delegateWarning')}
            </p>
          </div>
        )}

        {/* 재검사 모드 안내 */}
        {reInspectMode && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-lg text-sm">
            <RotateCcw className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-700 dark:text-red-300">
              {t('kiosk.selfInspect.reInspectTitle', { n: reInspectRound })} — {t('kiosk.selfInspect.allSamplesRequired')}
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          {displayItems.length === 0 && !reInspectMode ? (
            <Button onClick={onDone}>{t('common.close')}</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!allTabsComplete || saving}>
              {reInspectMode
                ? <><RotateCcw className="w-4 h-4 mr-1" />{t('kiosk.selfInspect.reInspect')}</>
                : <><CheckCircle2 className="w-4 h-4 mr-1" />{saving ? t('common.saving') : t('kiosk.selfInspect.save')}</>
              }
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
