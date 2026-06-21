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
import { CheckCircle2, XCircle, Save, AlertTriangle, Wrench } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import { InspectItemImage } from '@/components/shared';

interface InspectItem {
  seq: number;
  sortSeq?: number | null;
  itemName: string;
  criteria?: string;
  itemType: 'MEASURE' | 'VISUAL';
  unit?: string | null;
  lslValue?: number | null;
  uslValue?: number | null;
  imageUrl?: string | null;
}

type ItemResult = 'PASS' | 'FAIL' | '';
type InspectDetails = Record<string, unknown>;

interface CompletedInspectLog {
  inspectDate?: string;
  workDate?: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  inspectorName?: string | null;
  overallResult?: string | null;
  details?: InspectDetails | string | null;
  remark?: string | null;
}

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

function parseInspectDetails(details: CompletedInspectLog['details']): InspectDetails {
  if (!details) return {};
  if (typeof details === 'object') return details;
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' ? parsed as InspectDetails : {};
  } catch {
    return {};
  }
}

function getCompletedItemValue(
  details: InspectDetails,
  item: InspectItem,
  suffix = '',
): string {
  const key = `${item.seq}_${item.itemName}${suffix}`;
  const value = details[key];
  return value == null ? '' : String(value);
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
  const [completedInspect, setCompletedInspect] = useState<CompletedInspectLog | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const displayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setInspectTime(`${displayDate} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setCompletedInspect(null);

    const controller = new AbortController();

    api.get('/equipment/daily-inspect/check', {
      params: { equipCode: selectedEquip?.equipCode, inspectType: 'DAILY' },
      signal: controller.signal,
    }).then(res => {
      const status = res.data?.data ?? {};
      if (status.alreadyInspected) {
        setAlreadyDone(true);
        setInterlock('dailyInspectDone', true);
        const workDate = status.workDate ?? displayDate;
        api.get(`/equipment/daily-inspect/${selectedEquip?.equipCode}/${workDate}`, {
          signal: controller.signal,
        }).then(detailRes => {
          setCompletedInspect({
            ...(detailRes.data?.data ?? {}),
            workDate,
            windowStart: status.windowStart ?? null,
            windowEnd: status.windowEnd ?? null,
          });
        }).catch(() => setCompletedInspect({
          workDate,
          windowStart: status.windowStart ?? null,
          windowEnd: status.windowEnd ?? null,
        }));
      } else {
        setAlreadyDone(false);
        setCompletedInspect(null);
      }
    }).catch(() => {});

    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip?.equipCode, inspectType: 'DAILY', limit: '100' },
      signal: controller.signal,
    }).then(res => {
      const data: InspectItem[] = (res.data?.data ?? []).map((i: InspectItem, index: number) => ({
        ...i,
        seq: Number(i.seq ?? i.sortSeq ?? index + 1),
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
  }, [isOpen, selectedEquip, setInterlock]);

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
  }, [selectedEquip, items, results, measureValues, remarks, inspectorName,
    anyFail, setInterlock, onDone, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.dailyInspectTitle')} size="2xl">
      {alreadyDone ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border border-green-500 rounded-lg text-green-700 dark:text-green-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8" />
              <div>
                <p className="text-base font-bold">{t('kiosk.prep.alreadyInspected')}</p>
                <p className="text-xs opacity-80">{selectedEquip?.equipName} ({selectedEquip?.equipCode})</p>
              </div>
            </div>
            <div className="text-right text-xs space-y-1">
              <p><span className="opacity-70">{t('kiosk.prep.workDate', '조업일')}</span> <span className="font-mono">{completedInspect?.workDate || '-'}</span></p>
              {completedInspect?.windowStart && completedInspect?.windowEnd && (
                <p><span className="opacity-70">{t('kiosk.prep.validWindow', '유효구간')}</span> <span className="font-mono">{completedInspect.windowStart} ~ {completedInspect.windowEnd}</span></p>
              )}
              <p><span className="opacity-70">{t('kiosk.prep.inspector', '점검자')}</span> <span className="font-semibold">{completedInspect?.inspectorName || '-'}</span></p>
              <p>
                <span className="opacity-70">{t('kiosk.prep.overallResult', '종합 판정')}</span>{' '}
                <span className={`font-bold ${completedInspect?.overallResult === 'FAIL' ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {completedInspect?.overallResult === 'FAIL' ? 'NG' : 'OK'}
                </span>
              </p>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="border-b border-border">
                    <th className="w-12 px-3 py-2 text-center text-xs text-text-muted font-medium">No</th>
                    <th className="w-16 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.image', '사진')}</th>
                    <th className="w-56 px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.itemName')}</th>
                    <th className="w-80 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.standard')}</th>
                    <th className="w-32 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.measureOrJudge')}</th>
                    <th className="w-20 px-3 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.result')}</th>
                    <th className="px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.remark')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const details = parseInspectDetails(completedInspect?.details);
                    const result = getCompletedItemValue(details, item) || 'PASS';
                    const value = getCompletedItemValue(details, item, '_value');
                    const remark = getCompletedItemValue(details, item, '_remark');
                    const isFail = result === 'FAIL';
                    return (
                      <tr key={item.seq} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-center text-xs text-text-muted">{item.seq}</td>
                        <td className="px-2 py-2 text-center">
                          <InspectItemImage imageUrl={item.imageUrl} alt={item.itemName} />
                        </td>
                        <td className="px-3 py-2 font-medium text-text whitespace-nowrap">{item.itemName}</td>
                        <td className="px-3 py-2 text-center text-xs text-text-muted">
                          {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              {item.lslValue != null ? item.lslValue : '-'}{' ~ '}{item.uslValue != null ? item.uslValue : '-'}
                              {item.unit ? ` ${item.unit}` : ''}
                            </span>
                          ) : item.criteria ? item.criteria : '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-sm">
                          {item.itemType === 'MEASURE' ? (value || '-') : (result === 'FAIL' ? 'NG' : 'OK')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                            isFail
                              ? 'border-red-500 text-red-700 dark:text-red-400'
                              : 'border-green-500 text-green-700 dark:text-green-400'
                          }`}>
                            {isFail ? 'NG' : 'OK'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-text-muted">{remark || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 border border-border rounded-lg text-sm text-text-muted">
              {completedInspect?.remark || t('kiosk.prep.noInspectItems')}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-border">
            <Button onClick={onDone}>{t('common.confirm')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 상단 정보 행: 설비(다크) · 점검자 · 진행 현황 (한 행) */}
          <div className="flex items-stretch gap-3">
            {/* 설비 정보 (다크) */}
            <div className="flex-1 min-w-0 p-3 bg-slate-800 dark:bg-slate-900 text-white rounded-lg text-sm flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="font-semibold truncate">{selectedEquip?.equipName}</span>
                <span className="text-slate-400 text-xs font-mono shrink-0">({selectedEquip?.equipCode})</span>
              </div>
              {selectedEquip?.processName && (
                <div className="flex items-center gap-2 pl-6 text-xs text-slate-300">
                  <span>{selectedEquip.processName}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pl-6 text-xs text-slate-400">
                <span>{t('kiosk.prep.inspectDate')}</span>
                <span className="font-mono text-slate-200">{inspectTime.split(' ')[0] || '-'}</span>
              </div>
            </div>

            {/* 점검자 (필수 — 핑크 강조) */}
            <div className="w-60 shrink-0 p-2.5 border border-rose-400 rounded-lg flex flex-col justify-center gap-1.5">
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {t('kiosk.prep.inspectorRequired')}
              </div>
              <select
                value={inspectorName}
                onChange={e => setInspectorName(e.target.value)}
                className="w-full text-sm border border-border rounded px-2 py-1 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-400"
              >
                <option value="">{t('kiosk.prep.inspectorPlaceholder')}</option>
                {inspectors.map(w => (
                  <option key={w.workerCode} value={w.workerName}>{w.workerName}</option>
                ))}
              </select>
              <div className="flex justify-between items-center text-[11px] text-text-muted">
                <span>{t('kiosk.prep.inspectTime')}</span>
                <span className="font-mono">{inspectTime}</span>
              </div>
            </div>

            {/* 진행 현황 */}
            {items.length > 0 && (
              <div className="w-48 shrink-0 p-2.5 border border-border rounded-lg flex flex-col justify-center gap-1.5">
                <p className="text-[11px] font-medium text-text-muted">{t('kiosk.prep.answeredProgress', '{{answered}} / {{total}} 항목', { answered: answeredCount, total: items.length })}</p>
                <div className="flex h-2 rounded-full overflow-hidden bg-border">
                  {okCount > 0 && (
                    <div className="bg-green-500 transition-all" style={{ width: `${(okCount / items.length) * 100}%` }} />
                  )}
                  {ngCount > 0 && (
                    <div className="bg-red-500 transition-all" style={{ width: `${(ngCount / items.length) * 100}%` }} />
                  )}
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-green-600 dark:text-green-400 font-medium">OK {okCount}</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">NG {ngCount}</span>
                  <span className="text-text-muted">{t('kiosk.prep.pendingCount', '미완료 {{count}}', { count: items.length - answeredCount })}</span>
                </div>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface/50 p-4 text-sm text-text">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 w-5 h-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text">
                    {t('kiosk.prep.noDailyInspectItemsTitle', '설비별로 배정된 설비일일점검 항목이 없습니다.')}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-text-muted">
                    {t('kiosk.prep.noDailyInspectItemsCurrent', {
                      defaultValue: '현재 선택 설비 {{equipName}}({{equipCode}})에 DAILY 점검항목이 연결되어 있지 않습니다. 항목이 배정되기 전에는 설비일일점검을 완료 처리할 수 없습니다.',
                      equipName: selectedEquip?.equipName ?? '',
                      equipCode: selectedEquip?.equipCode ?? '',
                    })}
                  </p>
                  <div className="mt-3 rounded border border-border bg-background/60 p-3">
                    <p className="text-xs font-semibold text-text">
                      {t('kiosk.prep.dailyInspectAssignGuideTitle', '사전 처리 절차')}
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-left text-xs leading-5 text-text-muted">
                      <li>{t('kiosk.prep.dailyInspectAssignStep1', '점검항목 자체가 없으면 기준정보 > 설비점검항목마스터(/master/equip-inspect-item)에서 점검유형 DAILY 항목을 먼저 등록합니다.')}</li>
                      <li>{t('kiosk.prep.dailyInspectAssignStep2', '좌측 메뉴에서 기준정보 > 설비점검항목(/master/equip-inspect) 화면으로 이동합니다.')}</li>
                      <li>{t('kiosk.prep.dailyInspectAssignStep3', '왼쪽 설비 목록에서 이 키오스크 설비를 선택합니다.')}</li>
                      <li>{t('kiosk.prep.dailyInspectAssignStep4', '점검유형을 설비일일점검 또는 일상점검(DAILY)으로 선택합니다.')}</li>
                      <li>{t('kiosk.prep.dailyInspectAssignStep5', '점검항목 추가 버튼을 눌러 필요한 항목을 선택하고 저장합니다.')}</li>
                      <li>{t('kiosk.prep.dailyInspectAssignStep6', '이 모달을 닫았다가 다시 열면 배정된 항목이 표시됩니다.')}</li>
                    </ol>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" onClick={onClose}>{t('common.close', '닫기')}</Button>
              </div>
            </div>
          ) : (
            <>
              {/* 점검 테이블 (전체 폭) */}
              <div className="overflow-x-auto max-h-[48vh] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="border-b border-border">
                      <th className="w-10 px-2 py-2 text-center text-xs text-text-muted font-medium">No</th>
                      <th className="w-14 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.image', '사진')}</th>
                      <th className="w-44 px-3 py-2 text-left text-xs text-text-muted font-medium">{t('kiosk.prep.itemName')}</th>
                      <th className="w-20 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.judgeMethod')}</th>
                      <th className="w-40 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.standard')}</th>
                      <th className="w-32 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.measureOrJudge')}</th>
                      <th className="w-16 px-2 py-2 text-center text-xs text-text-muted font-medium">{t('kiosk.prep.result')}</th>
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
                          <td className="px-2 py-2 text-center">
                            <InspectItemImage imageUrl={item.imageUrl} alt={item.itemName} />
                          </td>
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

              {/* 종합 판정 (전체 폭) */}
              {allAnswered && (
                <div className={`p-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 ${
                  anyFail
                    ? 'animate-pulse border-red-500 text-red-700 dark:text-red-300'
                    : 'border-green-500 text-green-700 dark:text-green-300'
                }`}>
                  {anyFail ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {anyFail
                    ? t('kiosk.prep.overallNgSummary', '{{total}}개 항목 중 {{ng}}건 NG', { total: items.length, ng: ngCount })
                    : t('kiosk.prep.overallPassSummary', '전 {{total}}개 항목 합격', { total: items.length })}
                </div>
              )}

              {/* 푸터 */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
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
              {saveDisabledReason && (
                <p className="text-[11px] text-text-muted mt-1" title={saveDisabledReason}>
                  {saveDisabledReason}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
