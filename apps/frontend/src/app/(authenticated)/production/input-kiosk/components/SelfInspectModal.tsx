"use client";

/**
 * @file components/SelfInspectModal.tsx
 * @description 자주검사 모달 — 다크헤더 + 테이블 레이아웃 + NG 재검사
 *
 * 초보자 가이드:
 * - FIRST: sampleCount개 탭 (각 탭 = 시료 1개)
 * - MID/LAST: 탭 1개, 시점 드롭다운으로 MID↔LAST 전환 가능
 * - 종합 FAIL 시 NG 재검사 버튼 → 새 sampleNo 행 삽입
 * - 파괴검사 항목 존재 시 경고 배너 표시
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  FlaskConical, CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw, User, Flame,
} from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore, type InspectTiming } from '@/stores/kioskStore';
import SelfInspectItemRow, {
  type SelfInspectItem,
  type SampleItemResult,
} from './SelfInspectItemRow';
import SelfInspectReInspectPanel, { type PrevNgItem } from './SelfInspectReInspectPanel';

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

  const [currentTiming, setCurrentTiming] = useState<InspectTiming>(timing);
  const [items, setItems] = useState<SelfInspectItem[]>([]);
  const [results, setResults] = useState<ResultMap>({});
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [reInspectMode, setReInspectMode] = useState(false);
  const [reInspectRound, setReInspectRound] = useState(1);
  const [baseSampleCount, setBaseSampleCount] = useState(1);
  const [prevNgSummary, setPrevNgSummary] = useState<PrevNgItem[]>([]);
  const [prevInspectTime, setPrevInspectTime] = useState('');
  const [reInspectSampleCount, setReInspectSampleCount] = useState(1);

  useEffect(() => { setCurrentTiming(timing); }, [timing]);

  const sampleCount = currentTiming === 'FIRST' ? Math.max(1, items[0]?.sampleCount ?? 1) : 1;

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
        timing: currentTiming,
      },
      signal: controller.signal,
    }).then(res => {
      const data: SelfInspectItem[] = (res.data?.data ?? []).map((i: SelfInspectItem) => ({
        ...i,
        itemType: i.itemType || 'VISUAL',
        sampleCount: i.sampleCount || 1,
      }));
      setItems(data);
      const count = currentTiming === 'FIRST' ? Math.max(1, data[0]?.sampleCount ?? 1) : 1;
      setBaseSampleCount(count);
      const init: ResultMap = {};
      for (let s = 0; s < count; s++) init[s] = {};
      setResults(init);
    }).catch((err: unknown) => {
      if ((err as { name?: string })?.name !== 'CanceledError') {
        setItems([]);
        setFetchError(true);
      }
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [isOpen, currentTiming, selectedEquip, selectedJobOrder]);

  const handleResultChange = useCallback((sampleIdx: number, itemId: string, next: SampleItemResult) => {
    setResults(prev => ({ ...prev, [sampleIdx]: { ...prev[sampleIdx], [itemId]: next } }));
  }, []);

  const handleReInspectCount = useCallback((n: number) => {
    setReInspectSampleCount(n);
    const init: ResultMap = {};
    for (let s = 0; s < n; s++) init[s] = {};
    setResults(init);
    setActiveTab(0);
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
    : Array.from({ length: reInspectSampleCount }, (_, i) => i).every(i => isTabComplete(i, displayItems));
  const submitDisabledReason = saving
    ? t('common.saving')
    : !allTabsComplete
      ? t('kiosk.selfInspect.answerAll')
      : '';

  const hasDelegates = items.some(i => i.inspectMethod === 'DELEGATE');
  const hasDestructive = items.some(i => i.isDestructive);

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
      const tabCount = reInspectMode ? reInspectSampleCount : sampleCount;
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
            timing: currentTiming,
            inspectMethod: item.inspectMethod,
            status,
            prodQtyAtInspect: savedResultCount,
            inspectorId: selectedWorkers[0]?.id,
            remark: r?.remark,
            sampleNo,
            measureValue: item.itemType === 'MEASURE' && r?.value ? Number(r.value) : undefined,
          }, { skipSuccessToast: true }));
        }
      }
      await Promise.all(promises);

      if (hasDelegates && selectedJobOrder) {
        const res = await api.get(`/production/self-inspect/pending/${selectedJobOrder.orderNo}`);
        setHasPendingDelegate(res.data?.data?.hasPending ?? false);
      }

      if (currentTiming === 'MID') setMidInspectDone(true);

      const failItems = targetItems.filter(item => {
        for (let s = 0; s < tabCount; s++) {
          if (results[s]?.[item.id]?.result === 'FAIL') return true;
        }
        return false;
      });

      if (failItems.length > 0) {
        toast.error(t('kiosk.selfInspect.savedWithFail', { count: failItems.length }), { duration: 5000 });
        if (!reInspectMode) {
          // NG 요약 저장
          const ngItems: PrevNgItem[] = [];
          for (let s = 0; s < tabCount; s++) {
            for (const item of targetItems) {
              if (results[s]?.[item.id]?.result === 'FAIL') {
                ngItems.push({ itemName: item.itemName, sampleIdx: s, value: results[s][item.id].value });
              }
            }
          }
          setPrevNgSummary(ngItems);
          setPrevInspectTime(new Date().toLocaleTimeString());
          setReInspectSampleCount(1);
          setReInspectMode(true);
          setActiveTab(0);
          setResults({ 0: {} });
        } else {
          setReInspectRound(prev => prev + 1);
          setReInspectSampleCount(1);
          setResults({ 0: {} });
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
      reInspectRound, reInspectSampleCount, results, currentTiming, selectedJobOrder, selectedEquip,
      selectedWorkers, savedResultCount, hasDelegates, setHasPendingDelegate, setMidInspectDone, onDone, t]);

  const title = reInspectMode
    ? t('kiosk.selfInspect.reInspectTitle', { n: reInspectRound })
    : `${timingLabel[currentTiming]} ${t('kiosk.selfInspect.title')}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="full">
      <div className="space-y-3">
        {/* 다크 헤더 카드 */}
        <div className="p-3 bg-slate-800 dark:bg-slate-900 text-white rounded-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FlaskConical className="w-4 h-4 text-blue-300 shrink-0" />
              {/* 시점 표시 or 드롭다운 */}
              {currentTiming === 'FIRST' ? (
                <span className="text-sm font-bold text-blue-300">{timingLabel.FIRST}</span>
              ) : (
                <select
                  value={currentTiming}
                  onChange={e => setCurrentTiming(e.target.value as InspectTiming)}
                  className="text-sm font-bold text-blue-300 bg-transparent border-b border-blue-500 focus:outline-none"
                >
                  <option value="MID">{timingLabel.MID}</option>
                  <option value="LAST">{timingLabel.LAST}</option>
                </select>
              )}
              {selectedJobOrder && (
                <span className="text-xs font-mono text-slate-300 truncate">{selectedJobOrder.orderNo}</span>
              )}
              {selectedEquip && (
                <span className="text-xs text-slate-400 truncate">{selectedEquip.equipName}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedWorkers.slice(0, 2).map(w => (
                <span key={w.id} className="inline-flex items-center gap-1 bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-full">
                  <User className="w-3 h-3" />{w.workerName}
                </span>
              ))}
              <span className="text-xs text-slate-400">{t('kiosk.selfInspect.resultCount', { count: savedResultCount })}</span>
            </div>
          </div>
        </div>

        {/* 파괴검사 경고 배너 */}
        {hasDestructive && !reInspectMode && (
          <div className="flex items-center gap-2 p-2.5 border border-red-500 rounded-lg text-xs text-red-700 dark:text-red-300">
            <Flame className="w-4 h-4 shrink-0" />
            {t('kiosk.selfInspect.destructiveWarning')}
          </div>
        )}

        {/* 시료 탭 (일반 / 재검사 공통) */}
        {((!reInspectMode && sampleCount > 1) || (reInspectMode && reInspectSampleCount > 1)) && (
          <div className="flex gap-1 border-b border-border">
            {Array.from({ length: reInspectMode ? reInspectSampleCount : sampleCount }, (_, i) => {
              const tabItems = reInspectMode ? displayItems : items;
              const complete = isTabComplete(i, tabItems);
              const hasFail = tabItems.some(item => results[i]?.[item.id]?.result === 'FAIL');
              return (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === i ? 'bg-primary text-white'
                    : complete && hasFail ? 'border border-red-500 text-red-700 dark:text-red-300'
                    : complete ? 'border border-green-500 text-green-700 dark:text-green-300'
                    : 'text-text-muted hover:bg-surface'
                  }`}
                >
                  {t('kiosk.selfInspect.sampleTab', { n: i + 1 })}
                  {complete && (hasFail ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />)}
                </button>
              );
            })}
          </div>
        )}

        {/* 항목 테이블 */}
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
          <div className="overflow-x-auto max-h-[42vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="border-b border-border">
                  <th className="w-12 px-2 py-2 text-center text-xs text-text-muted font-medium">No</th>
                  <th className="w-56 px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.itemName')}</th>
                  <th className="w-24 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.judgeMethod')}</th>
                  <th className="w-80 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.standard')}</th>
                  <th className="w-44 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.measureOrJudge')}</th>
                  <th className="w-20 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.result')}</th>
                  <th className="px-2 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.remark')}</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => (
                  <SelfInspectItemRow
                    key={item.id}
                    rowIndex={idx}
                    item={item}
                    result={results[activeTab]?.[item.id]}
                    onChange={(itemId, next) => handleResultChange(activeTab, itemId, next)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 의뢰검사 안내 */}
        {hasDelegates && !reInspectMode && (
          <div className="flex items-start gap-2 p-2.5 border border-orange-400 dark:border-orange-700 rounded-lg">
            <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              {t('kiosk.selfInspect.delegateWarning')}
            </p>
          </div>
        )}

        {/* 재검사 이전 결과 + 수량 선택 */}
        {reInspectMode && (
          <SelfInspectReInspectPanel
            prevNgSummary={prevNgSummary}
            prevInspectTime={prevInspectTime}
            reInspectRound={reInspectRound}
            baseSampleCount={baseSampleCount}
            reInspectSampleCount={reInspectSampleCount}
            hasDestructive={hasDestructive}
            onCountChange={handleReInspectCount}
          />
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          {displayItems.length === 0 && !reInspectMode ? (
            <Button onClick={onDone}>{t('common.close')}</Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!allTabsComplete || saving}
              title={submitDisabledReason || (reInspectMode ? t('kiosk.selfInspect.reInspect') : t('kiosk.selfInspect.save'))}
            >
              {reInspectMode
                ? <><RotateCcw className="w-4 h-4 mr-1" />{t('kiosk.selfInspect.reInspect')}</>
                : <><CheckCircle2 className="w-4 h-4 mr-1" />{saving ? t('common.saving') : t('kiosk.selfInspect.save')}</>
              }
            </Button>
          )}
        </div>
        {submitDisabledReason && !saving && (
          <p className="text-[11px] text-text-muted mt-1" title={submitDisabledReason}>
            {submitDisabledReason}
          </p>
        )}
      </div>
    </Modal>
  );
}
