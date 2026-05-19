"use client";

/**
 * @file components/SelfInspectModal.tsx
 * @description 자주검사 모달 — 초물/중물/종물 검사항목 표시 및 결과 저장
 *
 * 초보자 가이드:
 * - 검사 시점(timing): FIRST(초물), MID(중물), LAST(종물)
 * - 직접검사(DIRECT): 즉시 PASS/FAIL 선택
 * - 의뢰검사(DELEGATE): PENDING 저장 → 실적입력 차단 → 별도 화면에서 처리
 * - 검사항목은 GET /production/self-inspect/items 에서 공정별 조회
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  FlaskConical, CheckCircle2, XCircle, Clock,
  Send, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore, type InspectTiming } from '@/stores/kioskStore';

interface InspectItem {
  id: string;
  itemName: string;
  standard: string | null;
  inspectMethod: 'DIRECT' | 'DELEGATE';
  timing: string;
  isDestructive: boolean;
}

type ItemResult = 'PASS' | 'FAIL' | 'PENDING' | null;

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
    savedResultCount, setHasPendingDelegate,
  } = useKioskStore();

  const [items, setItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setResults({});
    api.get('/production/self-inspect/items', {
      params: {
        processCode: selectedEquip?.processCode ?? selectedJobOrder?.processCode ?? '',
        timing,
      },
    })
      .then(res => setItems(res.data?.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isOpen, timing, selectedEquip, selectedJobOrder]);

  const setResult = useCallback((itemId: string, result: ItemResult) => {
    setResults(prev => ({ ...prev, [itemId]: result }));
  }, []);

  const allAnswered = items.length > 0 && items.every(item => results[item.id] !== null && results[item.id] !== undefined);
  const hasDelegates = items.some(item => item.inspectMethod === 'DELEGATE');

  const timingLabel: Record<InspectTiming, string> = {
    FIRST: t('kiosk.selfInspect.first'),
    MID: t('kiosk.selfInspect.mid'),
    LAST: t('kiosk.selfInspect.last'),
  };

  const handleSubmit = useCallback(async () => {
    if (!allAnswered) {
      toast.error(t('kiosk.selfInspect.answerAll'));
      return;
    }
    setSaving(true);
    try {
      const promises = items.map(item => {
        const itemResult = results[item.id];
        const status = item.inspectMethod === 'DELEGATE' ? 'PENDING' : (itemResult ?? 'PASS');
        return api.post('/production/self-inspect/results', {
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
        });
      });
      await Promise.all(promises);

      // 의뢰검사 대기 여부 업데이트
      if (hasDelegates && selectedJobOrder) {
        const res = await api.get(`/production/self-inspect/pending/${selectedJobOrder.orderNo}`);
        setHasPendingDelegate(res.data?.data?.hasPending ?? false);
      }

      const failCount = items.filter(i => results[i.id] === 'FAIL').length;
      const delegateCount = items.filter(i => i.inspectMethod === 'DELEGATE').length;

      if (failCount > 0) {
        toast.error(t('kiosk.selfInspect.savedWithFail', { count: failCount }), { duration: 4000 });
      } else if (delegateCount > 0) {
        toast(t('kiosk.selfInspect.delegatePending', { count: delegateCount }), { icon: '📋', duration: 4000 });
      } else {
        toast.success(t('kiosk.selfInspect.allPass'));
      }
      onDone();
    } catch {
      toast.error(t('kiosk.selfInspect.saveError'));
    } finally {
      setSaving(false);
    }
  }, [allAnswered, items, results, timing, selectedJobOrder, selectedEquip, selectedWorkers,
      savedResultCount, hasDelegates, setHasPendingDelegate, onDone, t]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${timingLabel[timing]} ${t('kiosk.selfInspect.title')}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* 헤더 정보 */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <FlaskConical className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-blue-700 dark:text-blue-300">
              {timingLabel[timing]} {t('kiosk.selfInspect.inspect')}
            </span>
            {selectedJobOrder && (
              <span className="ml-2 text-blue-500 font-mono text-xs">{selectedJobOrder.orderNo}</span>
            )}
          </div>
          <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">
            {t('kiosk.selfInspect.resultCount', { count: savedResultCount })}
          </span>
        </div>

        {/* 검사항목 목록 */}
        {loading ? (
          <div className="py-8 text-center text-text-muted text-sm">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3 text-text-muted">
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <p className="text-sm">{t('kiosk.selfInspect.noItems')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {items.map(item => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition-colors ${
                  results[item.id] === 'PASS' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : results[item.id] === 'FAIL' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : results[item.id] === 'PENDING' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  : 'bg-surface border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text">{item.itemName}</span>
                      {item.isDestructive && (
                        <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                          {t('kiosk.selfInspect.destructive')}
                        </span>
                      )}
                      {item.inspectMethod === 'DELEGATE' && (
                        <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                          {t('kiosk.selfInspect.delegate')}
                        </span>
                      )}
                    </div>
                    {item.standard && (
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        {item.standard}
                      </p>
                    )}
                  </div>

                  {/* 결과 입력 버튼 */}
                  {item.inspectMethod === 'DELEGATE' ? (
                    /* 의뢰검사: 버튼 없이 자동 PENDING */
                    <button
                      onClick={() => setResult(item.id, 'PENDING')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        results[item.id] === 'PENDING'
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-surface border-border text-text-muted hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {t('kiosk.selfInspect.requestDelegate')}
                    </button>
                  ) : (
                    /* 직접검사: PASS / FAIL */
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setResult(item.id, 'PASS')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          results[item.id] === 'PASS'
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-surface border-border text-text-muted hover:bg-green-50 hover:border-green-400 hover:text-green-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        PASS
                      </button>
                      <button
                        onClick={() => setResult(item.id, 'FAIL')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          results[item.id] === 'FAIL'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-surface border-border text-text-muted hover:bg-red-50 hover:border-red-400 hover:text-red-700'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        FAIL
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 의뢰검사 안내 */}
        {hasDelegates && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
            <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              {t('kiosk.selfInspect.delegateWarning')}
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          {items.length === 0 ? (
            <Button onClick={onDone}>{t('common.close')}</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!allAnswered || saving}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {saving ? t('common.saving') : t('kiosk.selfInspect.save')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
