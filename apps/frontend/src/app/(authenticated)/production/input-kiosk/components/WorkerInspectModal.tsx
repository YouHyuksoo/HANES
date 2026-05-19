"use client";

/**
 * @file components/WorkerInspectModal.tsx
 * @description 작업자 설비 자가점검 확인 모달
 *
 * 초보자 가이드:
 * - 작업지시 변경 시 작업자가 설비 상태를 직접 확인하는 체크리스트
 * - 현재는 기본 체크 항목을 표시하고 작업자가 OK 체크 후 서명(이름) 확인
 * - 향후 백엔드 작업자점검 API 연동 예정
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, User, Wrench } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useKioskStore } from '@/stores/kioskStore';
import toast from 'react-hot-toast';

const DEFAULT_CHECK_ITEMS = [
  'workerInspect.check1',
  'workerInspect.check2',
  'workerInspect.check3',
  'workerInspect.check4',
  'workerInspect.check5',
];

interface WorkerInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function WorkerInspectModal({ isOpen, onClose, onDone }: WorkerInspectModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder, selectedWorkers, setInterlock } = useKioskStore();
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const allChecked = DEFAULT_CHECK_ITEMS.every(key => checks[key]);

  const handleToggle = useCallback((key: string) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleConfirm = useCallback(() => {
    setInterlock('workerInspectDone', true);
    toast.success(t('kiosk.prep.workerInspectDone'));
    onDone();
  }, [setInterlock, onDone, t]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('kiosk.prep.workerInspectTitle')}
      size="md"
    >
      <div className="space-y-4">
        {/* 설비 + 작업지시 정보 */}
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm space-y-1">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <span className="font-medium">{selectedEquip?.equipName}</span>
            <span className="text-text-muted text-xs">({selectedEquip?.equipCode})</span>
          </div>
          {selectedJobOrder && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-text-muted">{t('kiosk.prep.jobOrder')}:</span>
              <span className="font-mono text-primary text-xs">{selectedJobOrder.orderNo}</span>
            </div>
          )}
        </div>

        {/* 작업자 정보 */}
        {selectedWorkers.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-border text-sm">
            <User className="w-4 h-4 text-primary" />
            <span className="text-text-muted">{t('kiosk.prep.inspector')}:</span>
            <span className="font-medium">{selectedWorkers.map(w => w.workerName).join(', ')}</span>
          </div>
        )}

        {/* 체크 항목 */}
        <p className="text-xs text-text-muted">{t('kiosk.prep.workerInspectDesc')}</p>
        <div className="space-y-2">
          {DEFAULT_CHECK_ITEMS.map(key => (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                checks[key]
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-surface border-border hover:bg-surface/80'
              }`}
            >
              {checks[key]
                ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                : <XCircle className="w-5 h-5 text-text-muted opacity-40 shrink-0" />}
              <span className={`text-sm ${checks[key] ? 'text-green-700 dark:text-green-300 font-medium' : 'text-text'}`}>
                {t(key)}
              </span>
            </button>
          ))}
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={!allChecked}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {t('kiosk.prep.confirmInspect')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
