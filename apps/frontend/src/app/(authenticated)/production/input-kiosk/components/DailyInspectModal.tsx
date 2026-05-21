"use client";

/**
 * @file components/DailyInspectModal.tsx
 * @description 설비 일일점검 입력 모달
 *
 * 초보자 가이드:
 * - MEASURE(측정형): 숫자 입력 → LSL/USL 비교 → PASS/FAIL 자동 판정
 * - VISUAL(판정형): OK/NG 버튼 직접 선택
 * - 항목별 비고 입력 지원
 * - 종합 판정 배너: 전항목 PASS=초록, NG 있음=빨간 깜빡임
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, ClipboardCheck, Save, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface InspectItem {
  seq: number;
  itemName: string;
  criteria?: string;
  itemType: 'MEASURE' | 'VISUAL';
  unit?: string | null;
  lslValue?: number | null;
  uslValue?: number | null;
}

type ItemResult = 'PASS' | 'FAIL' | '';

interface DailyInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

function judgeByRange(
  value: string,
  lsl: number | null | undefined,
  usl: number | null | undefined,
): 'PASS' | 'FAIL' | '' {
  if (!value.trim()) return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  if (lsl != null && num < lsl) return 'FAIL';
  if (usl != null && num > usl) return 'FAIL';
  return 'PASS';
}

export default function DailyInspectModal({ isOpen, onClose, onDone }: DailyInspectModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedWorkers, setInterlock } = useKioskStore();
  const [items, setItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Record<number, ItemResult>>({});
  const [measureValues, setMeasureValues] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen || !selectedEquip) return;
    api.get('/equipment/daily-inspect/check', {
      params: { equipCode: selectedEquip.equipCode, inspectDate: today },
    }).then(res => {
      if (res.data?.data?.alreadyInspected) {
        setAlreadyDone(true);
        setInterlock('dailyInspectDone', true);
        return;
      }
      setAlreadyDone(false);
    }).catch(() => {});

    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip.equipCode, inspectType: 'DAILY', limit: '100' },
    }).then(res => {
      const data: InspectItem[] = (res.data?.data ?? []).map((i: InspectItem) => ({
        ...i,
        itemType: i.itemType || 'VISUAL',
      }));
      setItems(data);
      const initResults: Record<number, ItemResult> = {};
      data.forEach(i => { initResults[i.seq] = ''; });
      setResults(initResults);
      setMeasureValues({});
      setRemarks({});
    }).catch(() => setItems([]));
  }, [isOpen, selectedEquip, today, setInterlock]);

  const handleVisualResult = useCallback((seq: number, val: 'PASS' | 'FAIL') => {
    setResults(prev => ({ ...prev, [seq]: val }));
  }, []);

  const handleMeasureChange = useCallback((seq: number, value: string, item: InspectItem) => {
    setMeasureValues(prev => ({ ...prev, [seq]: value }));
    setResults(prev => ({
      ...prev,
      [seq]: judgeByRange(value, item.lslValue, item.uslValue),
    }));
  }, []);

  const allAnswered = items.length > 0 && items.every(i => results[i.seq] !== '');
  const anyFail = items.some(i => results[i.seq] === 'FAIL');
  const inspectorName = selectedWorkers[0]?.workerName ?? '';

  const handleSave = useCallback(async () => {
    if (!selectedEquip) return;
    setSaving(true);
    try {
      const details: Record<string, string> = {};
      items.forEach(i => {
        const base = `${i.seq}_${i.itemName}`;
        details[base] = results[i.seq] || 'PASS';
        if (i.itemType === 'MEASURE' && measureValues[i.seq]) {
          details[`${base}_value`] = measureValues[i.seq];
        }
        if (remarks[i.seq]) details[`${base}_remark`] = remarks[i.seq];
      });

      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: today,
        inspectorName,
        overallResult: anyFail ? 'FAIL' : 'PASS',
        details,
      });

      setInterlock('dailyInspectDone', true);
      toast.success(t('kiosk.prep.dailyInspectSaved'));
      onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.prep.dailyInspectError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedEquip, items, results, measureValues, remarks, today, inspectorName,
      anyFail, setInterlock, onDone, t]);

  const handleSkip = useCallback(async () => {
    if (!selectedEquip) return;
    setSaving(true);
    try {
      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: today,
        inspectorName,
        overallResult: 'PASS',
        remark: '항목 없음 - 자동완료',
      });
      setInterlock('dailyInspectDone', true);
      toast.success(t('kiosk.prep.dailyInspectSaved'));
      onDone();
    } catch {
      setInterlock('dailyInspectDone', true);
      onDone();
    } finally {
      setSaving(false);
    }
  }, [selectedEquip, today, inspectorName, setInterlock, onDone, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.dailyInspectTitle')} size="xl">
      {alreadyDone ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <p className="text-lg font-bold text-text">{t('kiosk.prep.alreadyInspected')}</p>
          <p className="text-sm text-text-muted">{today}</p>
          <Button onClick={onDone}>{t('common.confirm')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 설비 정보 */}
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <span className="font-medium">{selectedEquip?.equipName}</span>
            <span className="text-text-muted">({selectedEquip?.equipCode})</span>
            <span className="ml-auto text-text-muted">{today}</span>
          </div>

          {/* 종합 판정 배너 */}
          {items.length > 0 && allAnswered && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${
              anyFail
                ? 'animate-pulse bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                : 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
            }`}>
              {anyFail
                ? <><XCircle className="w-4 h-4 shrink-0" /> {t('kiosk.prep.failWarning')}</>
                : <><CheckCircle2 className="w-4 h-4 shrink-0" /> {t('kiosk.selfInspect.overallPass')}</>
              }
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-text-muted">
              <AlertTriangle className="w-10 h-10 opacity-40" />
              <p className="text-sm">{t('kiosk.prep.noInspectItems')}</p>
              <Button onClick={handleSkip} disabled={saving}>
                {t('kiosk.prep.confirmWithoutItems')}
              </Button>
            </div>
          ) : (
            <>
              <div className="max-h-[50vh] overflow-y-auto space-y-2">
                {items.map(item => {
                  const r = results[item.seq];
                  const isFail = r === 'FAIL';
                  return (
                    <div key={item.seq}
                      className={`p-3 border rounded-lg transition-colors ${
                        isFail
                          ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                          : r === 'PASS'
                          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {item.seq}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text">{item.itemName}</p>
                          {item.criteria && (
                            <p className="text-xs text-text-muted">{t('kiosk.prep.standard')}: {item.criteria}</p>
                          )}
                          {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              {item.lslValue != null && `${t('kiosk.prep.lsl')}: ${item.lslValue}`}
                              {item.lslValue != null && item.uslValue != null && ' ~ '}
                              {item.uslValue != null && `${t('kiosk.prep.usl')}: ${item.uslValue}`}
                              {item.unit && ` (${item.unit})`}
                            </p>
                          )}
                        </div>

                        {item.itemType === 'MEASURE' ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number"
                              value={measureValues[item.seq] ?? ''}
                              onChange={e => handleMeasureChange(item.seq, e.target.value, item)}
                              placeholder={item.unit ?? t('kiosk.prep.measureValue')}
                              className="w-24 px-2 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {r === 'PASS' && <span className="text-xs font-bold text-green-600">PASS</span>}
                            {r === 'FAIL' && <span className="text-xs font-bold text-red-600">FAIL</span>}
                          </div>
                        ) : (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleVisualResult(item.seq, 'PASS')}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                                r === 'PASS'
                                  ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                                  : 'border-border text-text-muted hover:bg-green-50 dark:hover:bg-green-900/10'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" /> OK
                            </button>
                            <button
                              onClick={() => handleVisualResult(item.seq, 'FAIL')}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                                r === 'FAIL'
                                  ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                                  : 'border-border text-text-muted hover:bg-red-50 dark:hover:bg-red-900/10'
                              }`}
                            >
                              <XCircle className="w-4 h-4" /> NG
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 항목별 비고 */}
                      <div className="mt-2 pl-10">
                        <input
                          type="text"
                          value={remarks[item.seq] ?? ''}
                          onChange={e => setRemarks(prev => ({ ...prev, [item.seq]: e.target.value }))}
                          placeholder={t('kiosk.prep.remark')}
                          className="w-full px-2 py-1 text-xs border border-border rounded bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={handleSave} disabled={!allAnswered || saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? t('common.saving') : t('kiosk.prep.saveInspect')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
