"use client";

/**
 * @file components/WorkerInspectModal.tsx
 * @description 작업자 설비 자가점검 모달
 *
 * 초보자 가이드:
 * - 항목: GET /master/equip-inspect-items?inspectType=WORKER (API 연동)
 * - QR 스캔: workerQrCode 매칭 → 해당 항목 OK/NG 활성화
 * - 종합 판정: NG 있으면 작업 시작 차단
 * - 저장: POST /equipment/daily-inspect (inspectType=WORKER)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, QrCode, Wrench, User } from 'lucide-react';
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
    if (e.key === 'Enter' && qrInput.trim()) {
      handleQrScan(qrInput);
    }
  }, [qrInput, handleQrScan]);

  const handleResult = useCallback((seq: number, val: 'OK' | 'NG') => {
    setResults(prev => ({ ...prev, [seq]: val }));
    setActiveSeq(null);
    setTimeout(() => qrRef.current?.focus(), 50);
  }, []);

  const okCount = items.filter(i => results[i.seq] === 'OK').length;
  const ngCount = items.filter(i => results[i.seq] === 'NG').length;
  const pendingCount = items.filter(i => results[i.seq] === '').length;
  const allAnswered = items.length > 0 && pendingCount === 0;
  const anyNg = ngCount > 0;

  const handleSave = useCallback(async () => {
    if (!selectedEquip || !allAnswered) return;
    setSaving(true);
    try {
      const details = items.map(i => ({ seq: i.seq, itemName: i.itemName, result: results[i.seq] }));
      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: new Date().toISOString().split('T')[0],
        inspectorName: selectedWorkers.map(w => w.workerName).join(', '),
        inspectType: 'WORKER',
        overallResult: anyNg ? 'FAIL' : 'PASS',
        details,
      });
      setInterlock('workerInspectDone', !anyNg);
      toast.success(t('kiosk.prep.workerInspectSaved'));
      if (!anyNg) onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.prep.workerInspectSaveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedEquip, allAnswered, items, results, selectedWorkers, anyNg, setInterlock, onDone, t]);

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title={t('kiosk.prep.workerInspectTitle')} size="lg">
      <div className="space-y-4">
        {/* 설비 + 작업지시 + 작업자 */}
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm space-y-1">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <span className="font-medium">{selectedEquip?.equipName}</span>
            <span className="text-text-muted text-xs">({selectedEquip?.equipCode})</span>
          </div>
          {selectedJobOrder && (
            <div className="flex items-center gap-2 pl-6 text-xs text-text-muted">
              {t('kiosk.prep.jobOrder')}: <span className="font-mono text-primary">{selectedJobOrder.orderNo}</span>
            </div>
          )}
          {selectedWorkers.length > 0 && (
            <div className="flex items-center gap-2 pl-6 text-xs">
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="text-text-muted">{t('kiosk.prep.inspector')}:</span>
              <span className="font-medium">{selectedWorkers.map(w => w.workerName).join(', ')}</span>
            </div>
          )}
        </div>

        {/* QR 스캐너 입력 */}
        {items.some(i => i.workerQrCode) && (
          <div className="flex items-center gap-2 p-2 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/40 dark:bg-blue-900/10">
            <QrCode className="w-4 h-4 text-blue-500 shrink-0" />
            <input
              ref={qrRef}
              type="text"
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={handleQrKeyDown}
              placeholder={t('kiosk.prep.workerQrPlaceholder')}
              className="flex-1 text-sm bg-transparent focus:outline-none"
            />
          </div>
        )}

        {/* 진행 현황 */}
        {items.length > 0 && (
          <p className="text-xs text-text-muted text-right">
            {t('kiosk.prep.workerInspectProgress', { ok: okCount, ng: ngCount, pending: pendingCount })}
          </p>
        )}

        {/* 종합 판정 배너 */}
        {allAnswered && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${
            anyNg
              ? 'animate-pulse bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
              : 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
          }`}>
            {anyNg
              ? <><XCircle className="w-4 h-4" /> {t('kiosk.prep.failWarning')}</>
              : <><CheckCircle2 className="w-4 h-4" /> {t('kiosk.selfInspect.overallPass')}</>
            }
          </div>
        )}

        {/* 항목 목록 */}
        {loading ? (
          <div className="py-6 text-center text-text-muted text-sm">{t('common.loading')}</div>
        ) : loadError ? (
          <div className="py-6 text-center text-red-600 dark:text-red-400 text-sm">{t('kiosk.prep.loadItemsError')}</div>
        ) : (
          <div className="max-h-[40vh] overflow-y-auto space-y-2">
            {items.map(item => {
              const r = results[item.seq];
              const isActive = activeSeq === item.seq;
              return (
                <div key={item.seq}
                  className={`p-3 border rounded-lg transition-colors ${
                    r === 'OK' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : r === 'NG' ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    : isActive ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-900/10'
                    : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {item.seq}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">{item.itemName}</p>
                      {item.criteria && (
                        <p className="text-xs text-text-muted">{item.criteria}</p>
                      )}
                    </div>
                    {(isActive || !item.workerQrCode) ? (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleResult(item.seq, 'OK')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            r === 'OK'
                              ? 'bg-green-500 text-white border-green-500'
                              : 'border-border text-text-muted hover:bg-green-50 hover:border-green-400 hover:text-green-700'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" /> OK
                        </button>
                        <button onClick={() => handleResult(item.seq, 'NG')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            r === 'NG'
                              ? 'bg-red-500 text-white border-red-500'
                              : 'border-border text-text-muted hover:bg-red-50 hover:border-red-400 hover:text-red-700'
                          }`}
                        >
                          <XCircle className="w-4 h-4" /> NG
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">{t('kiosk.prep.workerQrRequired')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!allAnswered || saving}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {saving ? t('common.saving') : t('kiosk.prep.confirmInspect')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
