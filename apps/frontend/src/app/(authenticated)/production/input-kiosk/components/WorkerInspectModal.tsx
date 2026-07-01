"use client";

/**
 * @file components/WorkerInspectModal.tsx
 * @description 작업자 설비 자가점검 모달 — 다크헤더 + 2열 레이아웃
 *
 * 초보자 가이드:
 * - 항목: GET /master/equip-inspect-items?inspectType=WORKER
 * - QR 스캔: workerQrCode 매칭 → 해당 항목 OK/NG 활성화
 * - scanTimes: 로컬 state로 스캔/판정 시각 기록
 * - 저장: POST /equipment/daily-inspect (inspectType=WORKER)
 * - 작업 시작: 전항목 OK일 때만 활성화 → interlock 완료
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, QrCode, Wrench, User, Clock, Play } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import { BarcodeScanInput, InspectItemImage } from '@/components/shared';

interface WorkerInspectItem {
  seq: number;
  itemCode?: string | null;
  itemName: string;
  criteria?: string | null;
  workerQrCode?: string | null;
  imageUrl?: string | null;
}

type ItemResult = 'OK' | 'NG' | '';
type WorkerInspectApiItem = Omit<WorkerInspectItem, 'seq'> & {
  seq?: number | null;
  sortSeq?: number | null;
};

interface WorkerInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function WorkerInspectModal({ isOpen, onClose, onDone }: WorkerInspectModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder, selectedWorkers, setInterlock } = useKioskStore();
  const [items, setItems] = useState<WorkerInspectItem[]>([]);
  const [results, setResults] = useState<Record<number, ItemResult>>({});
  const [scanTimes, setScanTimes] = useState<Record<number, string>>({});
  const [ngReasons, setNgReasons] = useState<Record<number, string>>({});
  const [qrInput, setQrInput] = useState('');
  const [activeSeq, setActiveSeq] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const focusQrInput = useCallback((delay = 0) => {
    window.setTimeout(() => {
      qrRef.current?.focus();
      qrRef.current?.select();
    }, delay);
  }, []);

  const normalizeQrCode = useCallback((value: string | null | undefined) => {
    return String(value ?? '').trim().toUpperCase();
  }, []);

  const normalizeItems = useCallback((rows: WorkerInspectApiItem[]) => rows.map((item, index) => ({
    seq: Number(item.seq ?? item.sortSeq ?? index + 1),
    itemCode: item.itemCode ?? null,
    itemName: item.itemName,
    criteria: item.criteria ?? null,
    workerQrCode: item.workerQrCode ?? null,
    imageUrl: item.imageUrl ?? null,
  })), []);

  useEffect(() => {
    if (!isOpen || !selectedEquip) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setResults({});
    setScanTimes({});
    setNgReasons({});
    setQrInput('');
    setActiveSeq(null);
    rowRefs.current = {};
    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip.equipCode, inspectType: 'WORKER', limit: '100' },
      signal: controller.signal,
    }).then(res => {
      const data = normalizeItems(res.data?.data ?? []);
      setItems(data);
      const init: Record<number, ItemResult> = {};
      data.forEach(i => { init[i.seq] = ''; });
      setResults(init);
      focusQrInput();
    }).catch((err: unknown) => {
      if ((err as { name?: string })?.name !== 'CanceledError') {
        setItems([]);
        setLoadError(true);
      }
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [focusQrInput, isOpen, normalizeItems, selectedEquip]);

  useEffect(() => {
    if (isOpen) focusQrInput(100);
  }, [focusQrInput, isOpen]);

  useEffect(() => {
    if (isOpen && items.length > 0) focusQrInput(100);
  }, [focusQrInput, isOpen, items.length]);

  const handleQrScan = useCallback((code: string) => {
    const scanned = normalizeQrCode(code);
    const matched = items.find(item => normalizeQrCode(item.workerQrCode) === scanned);
    if (!matched) {
      toast.error(t('kiosk.prep.workerQrNotFound', { code }));
      setQrInput('');
      focusQrInput();
      return;
    }
    setActiveSeq(matched.seq);
    const matchedRow = rowRefs.current[matched.seq];
    matchedRow?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setQrInput('');
    focusQrInput();
  }, [focusQrInput, items, normalizeQrCode, t]);

  const handleResult = useCallback((seq: number, val: 'OK' | 'NG') => {
    const now = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setResults(prev => ({ ...prev, [seq]: val }));
    setScanTimes(prev => ({ ...prev, [seq]: now }));
    setActiveSeq(null);
    focusQrInput(50);
  }, [focusQrInput]);

  const okCount = items.filter(i => results[i.seq] === 'OK').length;
  const ngCount = items.filter(i => results[i.seq] === 'NG').length;
  const pendingCount = items.filter(i => results[i.seq] === '').length;
  const allAnswered = items.length > 0 && pendingCount === 0;
  const anyNg = ngCount > 0;
  const total = items.length || 1;
  const saveDisabledReason = saving
    ? t('common.saving')
    : !selectedJobOrder?.orderNo
      ? t('kiosk.prep.selectJobOrderFirst', '작업지시를 먼저 선택하세요.')
    : !allAnswered
      ? t('kiosk.prep.workerInspectDesc')
      : '';
  const startDisabledReason = saving
    ? t('common.saving')
    : !selectedJobOrder?.orderNo
      ? t('kiosk.prep.selectJobOrderFirst', '작업지시를 먼저 선택하세요.')
    : anyNg
      ? t('kiosk.prep.failWarning')
      : !allAnswered
        ? t('kiosk.prep.workerInspectDesc')
        : '';

  const doSave = useCallback(async (startWork: boolean) => {
    if (!selectedEquip || !allAnswered) return;
    if (!selectedJobOrder?.orderNo) {
      toast.error(t('kiosk.prep.selectJobOrderFirst', '작업지시를 먼저 선택하세요.'));
      return;
    }
    setSaving(true);
    try {
      const details = items.map(i => ({
        seq: i.seq,
        itemCode: i.itemCode ?? null,
        itemName: i.itemName,
        workerQrCode: i.workerQrCode ?? null,
        result: results[i.seq],
        ngReason: ngReasons[i.seq] ?? '',
      }));
      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        orderNo: selectedJobOrder.orderNo,
        inspectorName: selectedWorkers.map(w => w.workerName).join(', '),
        inspectType: 'WORKER',
        overallResult: anyNg ? 'FAIL' : 'PASS',
        details: { items: details },
      }, { skipSuccessToast: true });
      setInterlock('workerInspectDone', !anyNg || startWork);
      toast.success(t('kiosk.prep.workerInspectSaved'));
      if (startWork || !anyNg) onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.prep.workerInspectSaveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedEquip, selectedJobOrder?.orderNo, allAnswered, items, results, ngReasons, selectedWorkers, anyNg, setInterlock, onDone, t]);

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title={t('kiosk.prep.workerInspectTitle')} size="2xl">
      <div className="space-y-3">
        {/* 상단 정보 행: 설비/작업자 · QR 스캔 · 진행 현황 (한 행) */}
        <div className="flex items-stretch gap-3">
          {/* 설비 + 작업지시 + 작업자 (다크) */}
          <div className="flex-1 min-w-0 p-3 bg-slate-800 dark:bg-slate-900 text-white rounded-lg text-sm flex flex-col justify-center gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Wrench className="w-4 h-4 text-slate-300 shrink-0" />
              <span className="font-semibold truncate">{selectedEquip?.equipName}</span>
              <span className="text-slate-400 text-xs font-mono shrink-0">({selectedEquip?.equipCode})</span>
            </div>
            {selectedJobOrder && (
              <div className="flex items-center gap-2 pl-6 text-xs text-slate-300 min-w-0">
                <span className="font-mono text-blue-300 shrink-0">{selectedJobOrder.orderNo}</span>
                <span className="text-slate-500 shrink-0">·</span>
                <span className="truncate">{selectedJobOrder.itemName ?? ''}</span>
              </div>
            )}
            {selectedWorkers.length > 0 && (
              <div className="flex items-center gap-1.5 pl-6 flex-wrap">
                {selectedWorkers.map(w => (
                  <span key={w.id} className="inline-flex items-center gap-1 bg-blue-700/40 text-blue-200 text-xs px-2 py-0.5 rounded-full">
                    <User className="w-3 h-3" />{w.workerName}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* QR 스캐너 */}
          {items.length > 0 && (
            <div className="w-56 shrink-0 p-2.5 border border-blue-400 dark:border-blue-700 rounded-lg flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <QrCode className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t('kiosk.prep.workerQrScanner')}</span>
              </div>
              <BarcodeScanInput
                ref={qrRef}
                value={qrInput}
                onChange={setQrInput}
                onScan={handleQrScan}
                placeholder={t('kiosk.prep.workerQrPlaceholder')}
                maintainFocus={isOpen}
                fullWidth
              />
            </div>
          )}

          {/* 진행 현황 */}
          {items.length > 0 && (
            <div className="w-48 shrink-0 p-2.5 border border-border rounded-lg flex flex-col justify-center gap-1.5">
              <p className="text-[11px] font-medium text-text-muted">{t('kiosk.prep.workerInspectProgress', { ok: okCount, ng: ngCount, pending: pendingCount })}</p>
              <div className="flex h-2 rounded-full overflow-hidden bg-border">
                {okCount > 0 && (
                  <div className="bg-green-500 transition-all" style={{ width: `${(okCount / total) * 100}%` }} />
                )}
                {ngCount > 0 && (
                  <div className="bg-red-500 transition-all" style={{ width: `${(ngCount / total) * 100}%` }} />
                )}
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-green-600 dark:text-green-400 font-medium">OK {okCount}</span>
                <span className="text-red-600 dark:text-red-400 font-medium">NG {ngCount}</span>
                <span className="text-text-muted">{t('kiosk.prep.pendingCount', '미완료 {{count}}', { count: pendingCount })}</span>
              </div>
            </div>
          )}
        </div>

        {/* 항목 목록 (전체 폭) */}
        {loading ? (
          <div className="py-6 text-center text-text-muted text-sm">{t('common.loading')}</div>
        ) : loadError ? (
          <div className="py-6 text-center text-red-600 dark:text-red-400 text-sm">{t('kiosk.prep.loadItemsError')}</div>
        ) : (
          <div className="max-h-[48vh] overflow-y-auto space-y-1.5">
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface/50 p-4 text-sm text-text">
                <p className="font-semibold text-text">
                  {t('kiosk.prep.noWorkerInspectItemsTitle', '설비별로 배정된 작업자설비점검 항목이 없습니다.')}
                </p>
                <div className="mt-3 space-y-2 text-xs leading-5 text-text-muted">
                  <p>
                    {t('kiosk.prep.noWorkerInspectItemsCurrent', {
                      defaultValue: '현재 선택 설비 {{equipName}}({{equipCode}})에 WORKER 점검항목이 연결되어 있지 않습니다.',
                      equipName: selectedEquip?.equipName ?? '',
                      equipCode: selectedEquip?.equipCode ?? '',
                    })}
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-left">
                    <li>{t('kiosk.prep.workerInspectAssignStep1', '좌측 메뉴에서 기준정보 > 설비점검항목(/master/equip-inspect) 화면으로 이동합니다.')}</li>
                    <li>{t('kiosk.prep.workerInspectAssignStep2', '왼쪽 설비 목록에서 이 키오스크 설비를 선택합니다.')}</li>
                    <li>{t('kiosk.prep.workerInspectAssignStep3', '점검유형을 작업자점검 또는 작업자설비점검(WORKER)으로 선택합니다.')}</li>
                    <li>{t('kiosk.prep.workerInspectAssignStep4', '점검항목 추가 버튼을 눌러 필요한 항목을 선택하고 저장합니다.')}</li>
                    <li>{t('kiosk.prep.workerInspectAssignStep5', '이 모달을 닫았다가 다시 열면 배정된 항목이 표시됩니다.')}</li>
                  </ol>
                </div>
              </div>
            ) : items.map(item => {
                  const r = results[item.seq];
                  const isActive = activeSeq === item.seq;
                  const isNg = r === 'NG';
                  return (
                    <div
                      key={item.seq}
                      ref={el => { rowRefs.current[item.seq] = el; }}
                      tabIndex={isActive ? 0 : -1}
                      aria-current={isActive ? 'true' : undefined}
                      className={`p-2.5 border rounded-lg transition-colors ${
                      r === 'OK' ? 'border-green-500'
                      : r === 'NG' ? 'border-red-500'
                      : isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-300 dark:ring-blue-700'
                      : 'border-border'
                    }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {item.seq}
                        </span>
                        <div className="shrink-0">
                          <InspectItemImage imageUrl={item.imageUrl} alt={item.itemName} size={48} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-text">{item.itemName}</p>
                            {item.itemCode && (
                              <span className="px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-text-muted">
                                {item.itemCode}
                              </span>
                            )}
                          </div>
                          {item.criteria && <p className="text-xs text-text-muted">{item.criteria}</p>}
                          {item.workerQrCode && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono truncate">
                              QR {item.workerQrCode}
                            </p>
                          )}
                        </div>
                        {scanTimes[item.seq] && (
                          <span className="text-[10px] text-text-muted flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />{scanTimes[item.seq]}
                          </span>
                        )}
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleResult(item.seq, 'OK')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                              r === 'OK' ? 'bg-green-500 text-white border-green-500'
                              : 'border-border text-text-muted hover:border-green-400 hover:text-green-700 dark:hover:text-green-400'
                            }`}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> OK
                          </button>
                          <button onClick={() => handleResult(item.seq, 'NG')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                              r === 'NG' ? 'bg-red-500 text-white border-red-500'
                              : 'border-border text-text-muted hover:border-red-400 hover:text-red-700 dark:hover:text-red-400'
                            }`}>
                            <XCircle className="w-3.5 h-3.5" /> NG
                          </button>
                        </div>
                      </div>
                      {isNg && (
                        <div className="mt-1.5 pl-8">
                          <input
                            type="text"
                            value={ngReasons[item.seq] ?? ''}
                            onChange={e => setNgReasons(prev => ({ ...prev, [item.seq]: e.target.value }))}
                            placeholder={t('kiosk.prep.ngReasonPlaceholder')}
                            className="w-full px-2 py-1 text-xs border border-red-300 dark:border-red-700 rounded bg-surface focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>
        )}

        {/* 종합 판정 (전체 폭) */}
        {allAnswered && (
          <div className={`p-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 ${
            anyNg
              ? 'animate-pulse border-red-500 text-red-700 dark:text-red-300'
              : 'border-green-500 text-green-700 dark:text-green-300'
          }`}>
            {anyNg ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {anyNg ? t('kiosk.prep.failWarning') : t('kiosk.selfInspect.overallPass')}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="secondary"
            onClick={() => doSave(false)}
            disabled={!allAnswered || !selectedJobOrder?.orderNo || saving}
            title={saveDisabledReason || t('kiosk.prep.saveInspect')}
          >
            {saving ? t('common.saving') : t('kiosk.prep.saveInspect')}
          </Button>
          <Button
            onClick={() => doSave(true)}
            disabled={!allAnswered || !selectedJobOrder?.orderNo || anyNg || saving}
            title={startDisabledReason || t('kiosk.prep.startWork')}
          >
            <Play className="w-4 h-4 mr-1" />
            {t('kiosk.prep.startWork')}
          </Button>
        </div>
        {(saveDisabledReason || startDisabledReason) && (
          <p className="text-[11px] text-text-muted mt-1" title={startDisabledReason || saveDisabledReason}>
            {startDisabledReason || saveDisabledReason}
          </p>
        )}
      </div>
    </Modal>
  );
}
