"use client";

/**
 * @file components/DailyInspectModal.tsx
 * @description 설비 일일점검 입력 모달
 *
 * 초보자 가이드:
 * - 점검항목 조회: GET /master/equip-inspect-items?equipCode=&inspectType=DAILY
 * - 오늘 점검 확인: GET /equipment/daily-inspect/check?equipCode=&inspectDate=
 * - 점검 저장: POST /equipment/daily-inspect
 * - 모든 항목 PASS 또는 강제 저장 시 인터락 해제
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, ClipboardCheck, Save, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface InspectItem {
  seq: number;
  itemName: string;
  standard?: string;
  method?: string;
}

type ItemResult = 'PASS' | 'FAIL' | '';

interface DailyInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function DailyInspectModal({ isOpen, onClose, onDone }: DailyInspectModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedWorkers, setInterlock } = useKioskStore();
  const [items, setItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Record<number, ItemResult>>({});
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen || !selectedEquip) return;

    // 오늘 이미 점검했는지 확인
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

    // 점검 항목 조회
    api.get('/master/equip-inspect-items', {
      params: { equipCode: selectedEquip.equipCode, inspectType: 'DAILY', limit: '100' },
    }).then(res => {
      const data: InspectItem[] = res.data?.data ?? [];
      setItems(data);
      const init: Record<number, ItemResult> = {};
      data.forEach(i => { init[i.seq] = ''; });
      setResults(init);
    }).catch(() => setItems([]));
  }, [isOpen, selectedEquip, today, setInterlock]);

  const handleResult = useCallback((seq: number, val: ItemResult) => {
    setResults(prev => ({ ...prev, [seq]: val }));
  }, []);

  const allAnswered = items.length > 0 && items.every(i => results[i.seq] !== '');
  const anyFail = items.some(i => results[i.seq] === 'FAIL');
  const inspectorName = selectedWorkers[0]?.workerName ?? '';

  const handleSave = useCallback(async () => {
    if (!selectedEquip) return;
    setSaving(true);
    try {
      const details: Record<string, string> = {};
      items.forEach(i => { details[`${i.seq}_${i.itemName}`] = results[i.seq] || 'PASS'; });

      await api.post('/equipment/daily-inspect', {
        equipCode: selectedEquip.equipCode,
        inspectDate: today,
        inspectorName,
        overallResult: anyFail ? 'FAIL' : 'PASS',
        details,
        remark: remark || undefined,
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
  }, [selectedEquip, items, results, today, inspectorName, anyFail, remark, setInterlock, onDone, t]);

  // 점검항목 없을 때 바로 완료 처리
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('kiosk.prep.dailyInspectTitle')}
      size="lg"
    >
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

          {/* 점검 항목 없음 */}
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
              {/* 점검 항목 목록 */}
              <div className="max-h-80 overflow-y-auto space-y-2">
                {items.map((item) => (
                  <div key={item.seq}
                    className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-surface/50">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {item.seq}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">{item.itemName}</p>
                      {item.standard && (
                        <p className="text-xs text-text-muted">{t('kiosk.prep.standard')}: {item.standard}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleResult(item.seq, 'PASS')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                          results[item.seq] === 'PASS'
                            ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                            : 'border-border text-text-muted hover:bg-green-50 dark:hover:bg-green-900/10'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" /> OK
                      </button>
                      <button
                        onClick={() => handleResult(item.seq, 'FAIL')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                          results[item.seq] === 'FAIL'
                            ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                            : 'border-border text-text-muted hover:bg-red-50 dark:hover:bg-red-900/10'
                        }`}
                      >
                        <XCircle className="w-4 h-4" /> NG
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 비고 */}
              <input
                type="text"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder={t('kiosk.prep.remark')}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />

              {/* NG 경고 */}
              {anyFail && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {t('kiosk.prep.failWarning')}
                </div>
              )}

              {/* 저장 */}
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
