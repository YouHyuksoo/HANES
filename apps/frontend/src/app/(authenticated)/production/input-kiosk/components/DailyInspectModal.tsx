"use client";

/**
 * @file components/DailyInspectModal.tsx
 * @description 설비 일일점검 입력 모달 — PAGE 11 디자인 기준
 *
 * 초보자 가이드:
 * - MEASURE(측정형): 숫자 입력 → LSL/USL 비교 → PASS/FAIL 자동 판정
 * - VISUAL(판정형): OK/NG 선택(select)
 * - 점검자 드롭다운: 작업자 목록에서 선택 (필수, 핑크 강조)
 * - 종합 판정: 전항목 PASS=초록, NG 있음=빨간 깜빡임
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Save, AlertTriangle } from 'lucide-react';
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
  const [inspectors, setInspectors] = useState<{ workerCode: string; workerName: string }[]>([]);
  const [inspectorName, setInspectorName] = useState('');
  const [inspectTime, setInspectTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    setInspectTime(`${today} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

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
      const init: Record<number, ItemResult> = {};
      data.forEach(i => { init[i.seq] = ''; });
      setResults(init);
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

  const handleMeasureChange = useCallback((seq: number, value: string, item: InspectItem) => {
    setMeasureValues(prev => ({ ...prev, [seq]: value }));
    setResults(prev => ({ ...prev, [seq]: judgeByRange(value, item.lslValue, item.uslValue) }));
  }, []);

  const handleVisualChange = useCallback((seq: number, val: string) => {
    setResults(prev => ({ ...prev, [seq]: val as ItemResult }));
  }, []);

  const allAnswered = items.length > 0 && items.every(i => results[i.seq] !== '');
  const anyFail = items.some(i => results[i.seq] === 'FAIL');
  const okCount = items.filter(i => results[i.seq] === 'PASS').length;
  const ngCount = items.filter(i => results[i.seq] === 'FAIL').length;
  const answeredCount = okCount + ngCount;
  const saveDisabledReason = saving
    ? t('common.saving')
    : !inspectorName
      ? t('kiosk.prep.inspectorRequired')
      : !allAnswered
        ? t('kiosk.prep.workerInspectDesc')
        : '';

  const handleSave = useCallback(async () => {
    if (!selectedEquip) return;
    setSaving(true);
    try {
      const details: Record<string, string> = {};
      items.forEach(i => {
        const base = `${i.seq}_${i.itemName}`;
        details[base] = results[i.seq] || 'PASS';
        if (i.itemType === 'MEASURE' && measureValues[i.seq]) details[`${base}_value`] = measureValues[i.seq];
        if (remarks[i.seq]) details[`${base}_remark`] = remarks[i.seq];
      });
      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: today,
        inspectorName,
        inspectType: 'DAILY',
        overallResult: anyFail ? 'FAIL' : 'PASS',
        details,
      }, { skipSuccessToast: true });
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
      }, { skipSuccessToast: true });
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
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.dailyInspectTitle')} size="full">
      {alreadyDone ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <p className="text-lg font-bold text-text">{t('kiosk.prep.alreadyInspected')}</p>
          <p className="text-sm text-text-muted">{today}</p>
          <Button onClick={onDone}>{t('common.confirm')}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 상단: 설비정보 / 점검자 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* 왼쪽: 설비 정보 */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted">{t('kiosk.prep.equipCode')}</span>
                <span className="font-mono font-semibold">{selectedEquip?.equipCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted">{t('kiosk.prep.equipName')}</span>
                <span className="font-semibold truncate max-w-[140px]">{selectedEquip?.equipName}</span>
              </div>
              {selectedEquip?.processName && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-muted">{t('kiosk.prep.process')}</span>
                  <span>{selectedEquip.processName}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted">{t('kiosk.prep.inspectDate')}</span>
                <span className="font-mono">{today}</span>
              </div>
            </div>

            {/* 오른쪽: 점검자 (필수 — 핑크 강조) */}
            <div className="border border-rose-400 rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {t('kiosk.prep.inspectorRequired')}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted shrink-0">{t('kiosk.prep.inspector')}</span>
                <select
                  value={inspectorName}
                  onChange={e => setInspectorName(e.target.value)}
                  className="flex-1 text-sm border border-border rounded px-2 py-1 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-400"
                >
                  <option value="">{t('kiosk.prep.inspectorPlaceholder')}</option>
                  {inspectors.map(w => (
                    <option key={w.workerCode} value={w.workerName}>{w.workerName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between items-center text-xs text-text-muted">
                <span>{t('kiosk.prep.inspectTime')}</span>
                <span className="font-mono">{inspectTime}</span>
              </div>
              <p className="text-[10px] text-text-muted">
                ※ {t('kiosk.prep.inspectorHint')}
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-text-muted">
              <AlertTriangle className="w-10 h-10 opacity-40" />
              <p className="text-sm">{t('kiosk.prep.noInspectItems')}</p>
              <Button onClick={handleSkip} disabled={saving} title={saving ? t('common.saving') : t('kiosk.prep.confirmWithoutItems')}>
                {t('kiosk.prep.confirmWithoutItems')}
              </Button>
            </div>
          ) : (
            <>
              {/* 종합 판정 배너 — 항상 표시 */}
              <div className={`flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-colors ${
                allAnswered && anyFail
                  ? 'animate-pulse border-red-500 text-red-700 dark:text-red-300'
                  : allAnswered
                  ? 'border-green-500 text-green-700 dark:text-green-300'
                  : 'bg-surface border-border text-text-muted'
              }`}>
                <div>
                  <div className="text-xs font-bold opacity-70">{t('kiosk.prep.overallResult')}</div>
                  <div className="text-xs mt-0.5">
                    {allAnswered
                      ? anyFail
                        ? `${items.length}개 항목 중 ${ngCount}건 NG 발생`
                        : `전 ${items.length}개 항목 합격`
                      : `${answeredCount} / ${items.length} 항목 점검 중`}
                  </div>
                </div>
                <div className="text-base font-bold flex items-center gap-1">
                  {allAnswered
                    ? anyFail
                      ? <><XCircle className="w-5 h-5" /> 불합격 (NG)</>
                      : <><CheckCircle2 className="w-5 h-5" /> 합격 (OK)</>
                    : '—'}
                </div>
              </div>

              {/* 점검 테이블 */}
              <div className="overflow-x-auto max-h-[44vh] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="border-b border-border">
                      <th className="w-12 px-3 py-2 text-center text-xs text-text-muted font-medium">No</th>
                      <th className="w-56 px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.itemName')}</th>
                      <th className="w-24 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.judgeMethod')}</th>
                      <th className="w-80 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.standard')}</th>
                      <th className="w-44 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.measureOrJudge')}</th>
                      <th className="w-20 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.result')}</th>
                      <th className="px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.remark')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const r = results[item.seq];
                      const isFail = r === 'FAIL';
                      const isPass = r === 'PASS';
                      return (
                        <tr key={item.seq} className="border-b border-border last:border-0 transition-colors">
                          <td className="px-3 py-2 text-center text-xs text-text-muted">{item.seq}</td>
                          <td className="px-3 py-2 font-medium text-text whitespace-nowrap">{item.itemName}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.itemType === 'MEASURE'
                                ? 'border border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                                : 'border border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300'
                            }`}>
                              {item.itemType === 'MEASURE' ? t('kiosk.prep.measureType') : t('kiosk.prep.visualType')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-text-muted">
                            {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) ? (
                              <span className="text-blue-600 dark:text-blue-400">
                                {item.lslValue != null ? item.lslValue : '—'}{' ~ '}{item.uslValue != null ? item.uslValue : '—'}
                                {item.unit ? ` ${item.unit}` : ''}
                              </span>
                            ) : item.criteria ? item.criteria : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.itemType === 'MEASURE' ? (
                              <input
                                type="number"
                                value={measureValues[item.seq] ?? ''}
                                onChange={e => handleMeasureChange(item.seq, e.target.value, item)}
                                placeholder={item.unit ?? t('kiosk.prep.measureValue')}
                                className={`w-full px-2 py-1 text-sm text-right border rounded-lg bg-surface focus:outline-none focus:ring-1 ${
                                  isFail ? 'border-red-400 text-red-600 dark:text-red-400 font-bold focus:ring-red-400' : 'border-border focus:ring-primary'
                                }`}
                              />
                            ) : (
                              <select
                                value={r || ''}
                                onChange={e => handleVisualChange(item.seq, e.target.value)}
                                className={`w-full px-2 py-1 text-sm border rounded-lg bg-surface focus:outline-none focus:ring-1 ${
                                  isFail ? 'border-red-400 text-red-600 dark:text-red-400 font-bold focus:ring-red-400'
                                    : isPass ? 'border-green-400 text-green-700 dark:text-green-400 focus:ring-green-400'
                                    : 'border-border focus:ring-primary'
                                }`}
                              >
                                <option value="">—</option>
                                <option value="PASS">OK</option>
                                <option value="FAIL">NG</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isPass && (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold border border-green-500 text-green-700 dark:text-green-400">OK</span>
                            )}
                            {isFail && (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold border border-red-500 text-red-700 dark:text-red-400">NG</span>
                            )}
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

              {/* 푸터 */}
              <div className="space-y-1 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded font-semibold border border-green-500 text-green-700 dark:text-green-400">
                      OK {okCount}
                    </span>
                    <span className="px-2 py-0.5 rounded font-semibold border border-red-500 text-red-700 dark:text-red-400">
                      NG {ngCount}
                    </span>
                    {allAnswered && (
                      <span className="text-text-muted">
                        → 종합판정 <strong className={anyFail ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                          {anyFail ? 'NG' : 'OK'}
                        </strong>
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button
                      onClick={handleSave}
                      disabled={!allAnswered || !inspectorName || saving}
                      title={saveDisabledReason || t('kiosk.prep.saveInspect')}
                      className={allAnswered && anyFail ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : ''}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {saving
                        ? t('common.saving')
                        : allAnswered && anyFail
                        ? t('kiosk.prep.saveInspectNg')
                        : t('kiosk.prep.saveInspectOk')}
                    </Button>
                  </div>
                </div>
                {saveDisabledReason && (
                  <p className="text-[11px] text-text-muted" title={saveDisabledReason}>
                    {saveDisabledReason}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
