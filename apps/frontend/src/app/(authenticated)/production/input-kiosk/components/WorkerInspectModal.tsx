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

interface WorkerInspectItem {
  seq: number;
  itemName: string;
  criteria?: string | null;
  workerQrCode?: string | null;
}

type ItemResult = 'OK' | 'NG' | '';

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
    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip.equipCode, inspectType: 'WORKER', limit: '100' },
      signal: controller.signal,
    }).then(res => {
      const data: WorkerInspectItem[] = res.data?.data ?? [];
      setItems(data);
      const init: Record<number, ItemResult> = {};
      data.forEach(i => { init[i.seq] = ''; });
      setResults(init);
    }).catch((err: unknown) => {
      if ((err as { name?: string })?.name !== 'CanceledError') {
        setItems([]);
        setLoadError(true);
      }
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [isOpen, selectedEquip]);

  useEffect(() => {
    if (isOpen) setTimeout(() => qrRef.current?.focus(), 100);
  }, [isOpen]);

  const handleQrScan = useCallback((code: string) => {
    const matched = items.find(i => i.workerQrCode && i.workerQrCode === code.trim());
    if (!matched) {
      toast.error(t('kiosk.prep.workerQrNotFound', { code }));
      setQrInput('');
      return;
    }
    setActiveSeq(matched.seq);
    setQrInput('');
  }, [items, t]);

  const handleQrKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && qrInput.trim()) handleQrScan(qrInput);
  }, [qrInput, handleQrScan]);

  const handleResult = useCallback((seq: number, val: 'OK' | 'NG') => {
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setResults(prev => ({ ...prev, [seq]: val }));
    setScanTimes(prev => ({ ...prev, [seq]: now }));
    setActiveSeq(null);
    setTimeout(() => qrRef.current?.focus(), 50);
  }, []);

  const okCount = items.filter(i => results[i.seq] === 'OK').length;
  const ngCount = items.filter(i => results[i.seq] === 'NG').length;
  const pendingCount = items.filter(i => results[i.seq] === '').length;
  const allAnswered = items.length > 0 && pendingCount === 0;
  const anyNg = ngCount > 0;
  const total = items.length || 1;
  const saveDisabledReason = saving
    ? t('common.saving')
    : !allAnswered
      ? t('kiosk.prep.workerInspectDesc')
      : '';
  const startDisabledReason = saving
    ? t('common.saving')
    : anyNg
      ? t('kiosk.prep.failWarning')
      : !allAnswered
        ? t('kiosk.prep.workerInspectDesc')
        : '';

  const doSave = useCallback(async (startWork: boolean) => {
    if (!selectedEquip || !allAnswered) return;
    setSaving(true);
    try {
      const details = items.map(i => ({
        seq: i.seq,
        itemName: i.itemName,
        result: results[i.seq],
        ngReason: ngReasons[i.seq] ?? '',
      }));
      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: new Date().toISOString().split('T')[0],
        inspectorName: selectedWorkers.map(w => w.workerName).join(', '),
        inspectType: 'WORKER',
        overallResult: anyNg ? 'FAIL' : 'PASS',
        details,
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
  }, [selectedEquip, allAnswered, items, results, ngReasons, selectedWorkers, anyNg, setInterlock, onDone, t]);

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title={t('kiosk.prep.workerInspectTitle')} size="full">
      <div className="space-y-3">
        {/* 다크 헤더 카드 */}
        <div className="p-3 bg-slate-800 dark:bg-slate-900 text-white rounded-lg text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-slate-300 shrink-0" />
            <span className="font-semibold">{selectedEquip?.equipName}</span>
            <span className="text-slate-400 text-xs font-mono">({selectedEquip?.equipCode})</span>
          </div>
          {selectedJobOrder && (
            <div className="flex items-center gap-2 pl-6 text-xs text-slate-300">
              <span className="font-mono text-blue-300">{selectedJobOrder.orderNo}</span>
              <span className="text-slate-500">·</span>
              <span>{selectedJobOrder.itemName ?? ''}</span>
            </div>
          )}
          {selectedWorkers.length > 0 && (
            <div className="flex items-center gap-1.5 pl-6">
              {selectedWorkers.map(w => (
                <span key={w.id} className="inline-flex items-center gap-1 bg-blue-700/40 text-blue-200 text-xs px-2 py-0.5 rounded-full">
                  <User className="w-3 h-3" />{w.workerName}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_220px] gap-3">
          {/* 좌측: 항목 목록 */}
          <div className="space-y-1.5">
            {loading ? (
              <div className="py-6 text-center text-text-muted text-sm">{t('common.loading')}</div>
            ) : loadError ? (
              <div className="py-6 text-center text-red-600 dark:text-red-400 text-sm">{t('kiosk.prep.loadItemsError')}</div>
            ) : (
              <div className="max-h-[42vh] overflow-y-auto space-y-1.5">
                {items.map(item => {
                  const r = results[item.seq];
                  const isActive = activeSeq === item.seq;
                  const isNg = r === 'NG';
                  return (
                    <div key={item.seq} className={`p-2.5 border rounded-lg transition-colors ${
                      r === 'OK' ? 'border-green-500'
                      : r === 'NG' ? 'border-red-500'
                      : isActive ? 'border-blue-400'
                      : 'border-border'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {item.seq}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text">{item.itemName}</p>
                          {item.criteria && <p className="text-xs text-text-muted">{item.criteria}</p>}
                        </div>
                        {scanTimes[item.seq] && (
                          <span className="text-[10px] text-text-muted flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />{scanTimes[item.seq]}
                          </span>
                        )}
                        {(isActive || !item.workerQrCode) ? (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => handleResult(item.seq, 'OK')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                                r === 'OK' ? 'bg-green-500 text-white border-green-500'
                                : 'border-border text-text-muted hover:border-green-400 hover:text-green-700'
                              }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> OK
                            </button>
                            <button onClick={() => handleResult(item.seq, 'NG')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                                r === 'NG' ? 'bg-red-500 text-white border-red-500'
                                : 'border-border text-text-muted hover:border-red-400 hover:text-red-700'
                              }`}>
                              <XCircle className="w-3.5 h-3.5" /> NG
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted shrink-0">{t('kiosk.prep.workerQrRequired')}</span>
                        )}
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
          </div>

          {/* 우측 패널 */}
          <div className="flex flex-col gap-3">
            {/* QR 스캐너 */}
            {items.some(i => i.workerQrCode) && (
              <div className="p-2.5 border border-blue-400 dark:border-blue-700 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <QrCode className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t('kiosk.prep.workerQrScanner')}</span>
                </div>
                <input
                  ref={qrRef}
                  type="text"
                  value={qrInput}
                  onChange={e => setQrInput(e.target.value)}
                  onKeyDown={handleQrKeyDown}
                  placeholder={t('kiosk.prep.workerQrPlaceholder')}
                  className="w-full text-sm bg-transparent focus:outline-none border-b border-blue-200 dark:border-blue-700 pb-0.5"
                />
              </div>
            )}

            {/* 진행 현황 */}
            {items.length > 0 && (
              <div className="p-2.5 border border-border rounded-lg space-y-2">
                <p className="text-xs font-medium text-text-muted">{t('kiosk.prep.workerInspectProgress', { ok: okCount, ng: ngCount, pending: pendingCount })}</p>
                {/* 색상 분할 진행바 */}
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
                  <span className="text-text-muted">미완료 {pendingCount}</span>
                </div>
              </div>
            )}

            {/* 종합 판정 */}
            {allAnswered && (
              <div className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                anyNg
                  ? 'animate-pulse border-red-500 text-red-700 dark:text-red-300'
                  : 'border-green-500 text-green-700 dark:text-green-300'
              }`}>
                {anyNg ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {anyNg ? t('kiosk.prep.failWarning') : t('kiosk.selfInspect.overallPass')}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="secondary"
            onClick={() => doSave(false)}
            disabled={!allAnswered || saving}
            title={saveDisabledReason || t('kiosk.prep.saveInspect')}
          >
            {saving ? t('common.saving') : t('kiosk.prep.saveInspect')}
          </Button>
          <Button
            onClick={() => doSave(true)}
            disabled={!allAnswered || anyNg || saving}
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
