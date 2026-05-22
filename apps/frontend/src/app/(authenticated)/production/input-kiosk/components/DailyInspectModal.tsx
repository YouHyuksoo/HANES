"use client";

/**
 * @file components/DailyInspectModal.tsx
 * @description 설비 일일점검 입력 모달 — 테이블 레이아웃
 *
 * 초보자 가이드:
 * - MEASURE(측정형): 숫자 입력 → LSL/USL 비교 → PASS/FAIL 자동 판정
 * - VISUAL(판정형): OK/NG 버튼 직접 선택
 * - 점검자 드롭다운: 작업자 목록에서 선택 (설비관리팀 포함)
 * - 종합 판정: 전항목 PASS=초록, NG 있음=빨간 깜빡임
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, ClipboardCheck, Save, AlertTriangle, User } from 'lucide-react';
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
  const [inspectors, setInspectors] = useState<{ id: string; workerName: string }[]>([]);
  const [inspectorName, setInspectorName] = useState('');
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();

    api.get('/equipment/daily-inspect/check', {
      params: { equipCode: selectedEquip?.equipCode, inspectDate: today },
      signal: controller.signal,
    }).then(res => {
      if (res.data?.data?.alreadyInspected) {
        setAlreadyDone(true);
        setInterlock('dailyInspectDone', true);
      } else {
        setAlreadyDone(false);
      }
    }).catch(() => {});

    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip?.equipCode, inspectType: 'DAILY', limit: '100' },
      signal: controller.signal,
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

    api.get('/master/workers', { params: { limit: '200', useYn: 'Y' }, signal: controller.signal })
      .then(res => setInspectors(res.data?.data ?? []))
      .catch(() => setInspectors([]));

    return () => controller.abort();
  }, [isOpen, selectedEquip, today, setInterlock]);

  useEffect(() => {
    if (selectedWorkers[0]?.workerName) setInspectorName(selectedWorkers[0].workerName);
  }, [selectedWorkers]);

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
  const okCount = items.filter(i => results[i.seq] === 'PASS').length;
  const ngCount = items.filter(i => results[i.seq] === 'FAIL').length;

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
        inspectType: 'DAILY',
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
        inspectType: 'DAILY',
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
        <div className="space-y-3">
          {/* 설비 정보 + 점검자 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
              <ClipboardCheck className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedEquip?.equipName}</p>
                <p className="text-xs text-text-muted">{selectedEquip?.equipCode} · {today}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 border border-border rounded-lg">
              <User className="w-4 h-4 text-text-muted shrink-0" />
              <select
                value={inspectorName}
                onChange={e => setInspectorName(e.target.value)}
                className="flex-1 text-sm bg-transparent focus:outline-none"
              >
                <option value="">{t('kiosk.prep.inspectorPlaceholder')}</option>
                {inspectors.map(w => (
                  <option key={w.id} value={w.workerName}>{w.workerName}</option>
                ))}
              </select>
            </div>
          </div>

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
              {/* 점검 테이블 */}
              <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="border-b border-border">
                      <th className="w-10 px-3 py-2 text-center text-xs text-text-muted font-medium">No</th>
                      <th className="px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.itemName')}</th>
                      <th className="w-20 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.judgeMethod')}</th>
                      <th className="w-36 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.standard')}</th>
                      <th className="w-36 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.measureOrJudge')}</th>
                      <th className="w-16 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.result')}</th>
                      <th className="w-32 px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.remark')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const r = results[item.seq];
                      const isFail = r === 'FAIL';
                      const isPass = r === 'PASS';
                      return (
                        <tr key={item.seq} className={`border-b border-border last:border-0 transition-colors ${
                          isFail ? 'bg-red-50 dark:bg-red-950/30' : isPass ? 'bg-green-50 dark:bg-green-950/30' : ''
                        }`}>
                          <td className="px-3 py-2 text-center">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mx-auto">
                              {item.seq}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-text">{item.itemName}</p>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              item.itemType === 'MEASURE'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            }`}>
                              {item.itemType === 'MEASURE' ? t('kiosk.prep.measureType') : t('kiosk.prep.visualType')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-text-muted">
                            {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) ? (
                              <span className="text-blue-600 dark:text-blue-400">
                                {item.lslValue != null ? item.lslValue : '—'}
                                {' ~ '}
                                {item.uslValue != null ? item.uslValue : '—'}
                                {item.unit ? ` ${item.unit}` : ''}
                              </span>
                            ) : item.criteria ? (
                              <span>{item.criteria}</span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.itemType === 'MEASURE' ? (
                              <input
                                type="number"
                                value={measureValues[item.seq] ?? ''}
                                onChange={e => handleMeasureChange(item.seq, e.target.value, item)}
                                placeholder={item.unit ?? t('kiosk.prep.measureValue')}
                                className={`w-full px-2 py-1 text-sm border rounded-lg bg-surface focus:outline-none focus:ring-1 ${
                                  isFail
                                    ? 'border-red-400 text-red-600 dark:text-red-400 font-bold focus:ring-red-400'
                                    : 'border-border focus:ring-primary'
                                }`}
                              />
                            ) : (
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => handleVisualResult(item.seq, 'PASS')}
                                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                    isPass
                                      ? 'bg-green-500 text-white border-green-500'
                                      : 'border-border text-text-muted hover:bg-green-50 dark:hover:bg-green-900/20'
                                  }`}
                                >OK</button>
                                <button
                                  onClick={() => handleVisualResult(item.seq, 'FAIL')}
                                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                    isFail
                                      ? 'bg-red-500 text-white border-red-500'
                                      : 'border-border text-text-muted hover:bg-red-50 dark:hover:bg-red-900/20'
                                  }`}
                                >NG</button>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isPass && <span className="text-xs font-bold text-green-600 dark:text-green-400">PASS</span>}
                            {isFail && <span className="text-xs font-bold text-red-600 dark:text-red-400">FAIL</span>}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={remarks[item.seq] ?? ''}
                              onChange={e => setRemarks(prev => ({ ...prev, [item.seq]: e.target.value }))}
                              placeholder={t('kiosk.prep.remark')}
                              className="w-full px-2 py-1 text-xs border border-border rounded bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 종합 판정 푸터 */}
              {allAnswered && (
                <div className={`flex items-center justify-between p-3 rounded-lg border text-sm font-medium ${
                  anyFail
                    ? 'animate-pulse bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                    : 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                }`}>
                  <span>
                    {anyFail
                      ? <><XCircle className="w-4 h-4 inline mr-1" />{t('kiosk.prep.failWarning')}</>
                      : <><CheckCircle2 className="w-4 h-4 inline mr-1" />{t('kiosk.selfInspect.overallPass')}</>
                    }
                  </span>
                  <span className="text-xs font-semibold">
                    OK {okCount} / NG {ngCount}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button
                  onClick={handleSave}
                  disabled={!allAnswered || saving}
                  className={anyFail ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : ''}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saving
                    ? t('common.saving')
                    : anyFail
                    ? t('kiosk.prep.saveInspectNg')
                    : t('kiosk.prep.saveInspectOk')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
