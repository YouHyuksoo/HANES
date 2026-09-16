"use client";

/**
 * @file input-kiosk/components/ManagerCallModal.tsx
 * @description 관리자호출 팝업 — 호출 등록 / 대기시간 / 응대 처리
 *
 * 초보자 가이드:
 * 1. 호출 유형(설비이상/품질문의/자재요청/기타)과 내용을 적어 등록한다.
 * 2. 호출 중에는 대기시간이 흐르고, 헤더에 "호출중" 배지가 보인다.
 * 3. 담당자가 오면 "응대 완료"를 눌러 종료한다. 호출~응대 시간이 이력에 남는다.
 * 4. 1단계는 이력 기록 + 화면 표시까지다. 알림 발송은 넣지 않았다.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ComCodeSelect from '@/components/shared/ComCodeSelect';
import { formatElapsed, type EquipCallEvent } from '../hooks/useEquipStop';

interface ManagerCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipCode?: string | null;
  equipName?: string | null;
  openCall: EquipCallEvent | null;
  callElapsed: number;
  loading: boolean;
  onCall: (callType: string, callRemark?: string) => Promise<void>;
  onAck: (callId: number, ackRemark?: string) => Promise<void>;
}

const DEFAULT_CALL_TYPE = 'EQUIP';

export default function ManagerCallModal({
  isOpen, onClose, equipCode, equipName,
  openCall, callElapsed, loading, onCall, onAck,
}: ManagerCallModalProps) {
  const { t } = useTranslation();
  const [callType, setCallType] = useState(DEFAULT_CALL_TYPE);
  const [remark, setRemark] = useState('');
  const [ackRemark, setAckRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCallType(openCall?.callType ?? DEFAULT_CALL_TYPE);
    setRemark(openCall?.callRemark ?? '');
    setAckRemark('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, openCall?.callId]);

  const handleCall = async () => {
    setError(null);
    try {
      await onCall(callType, remark);
    } catch (e: unknown) {
      setError(extractMessage(e, t('kiosk.managerCall.callFailed', '관리자호출 등록에 실패했습니다.')));
    }
  };

  const handleAck = async () => {
    if (!openCall) return;
    setError(null);
    try {
      await onAck(openCall.callId, ackRemark);
      onClose();
    } catch (e: unknown) {
      setError(extractMessage(e, t('kiosk.managerCall.ackFailed', '응대 처리에 실패했습니다.')));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`${t('kiosk.managerCall.title', '관리자호출')}${equipName ? ` · ${equipName}` : ''}`}
    >
      <div className="space-y-5">
        {openCall ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-amber-500 py-6 dark:border-amber-400">
            <span className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
              <BellRing className="h-4 w-4" />
              {t('kiosk.managerCall.calling', '호출 중')}
            </span>
            <span
              data-testid="kiosk-call-elapsed"
              className="font-mono text-5xl font-extrabold tabular-nums leading-none text-amber-600 dark:text-amber-400"
            >
              {formatElapsed(callElapsed)}
            </span>
            <span className="text-xs text-black/60 dark:text-white/60">
              {t('kiosk.managerCall.calledAt', '호출 시각')} {openCall.calledAt}
              {openCall.calledBy ? ` · ${openCall.calledBy}` : ''}
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-border py-6 text-center text-sm text-black/60 dark:text-white/60">
            {t('kiosk.managerCall.idleHint', '도움이 필요한 유형과 내용을 적어 호출하세요. 호출 이력과 대기시간이 기록됩니다.')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-black/70 dark:text-white/70">
              {t('kiosk.managerCall.type', '호출유형')}
            </label>
            <ComCodeSelect
              groupCode="EQUIP_CALL_TYPE"
              includeAll={false}
              value={callType}
              onChange={(v) => setCallType(v)}
              disabled={Boolean(openCall)}
              fullWidth
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-black/70 dark:text-white/70">
              {t('kiosk.managerCall.remark', '호출 내용')}
            </label>
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={t('kiosk.managerCall.remarkPlaceholder', '어떤 도움이 필요한지')}
              maxLength={500}
              disabled={Boolean(openCall)}
            />
          </div>
        </div>

        {openCall && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-black/70 dark:text-white/70">
              {t('kiosk.managerCall.ackRemark', '응대 내용')}
            </label>
            <Input
              value={ackRemark}
              onChange={(e) => setAckRemark(e.target.value)}
              placeholder={t('kiosk.managerCall.ackRemarkPlaceholder', '어떻게 처리했는지')}
              maxLength={500}
            />
          </div>
        )}

        {error && (
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {openCall ? (
            <Button
              variant="primary"
              disabled={loading}
              onClick={handleAck}
              data-testid="kiosk-call-ack"
            >
              <Check className="mr-1 h-4 w-4" />
              {t('kiosk.managerCall.ack', '응대 완료')}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!equipCode || !callType || loading}
              onClick={handleCall}
              data-testid="kiosk-call-create"
            >
              <BellRing className="mr-1 h-4 w-4" />
              {t('kiosk.managerCall.call', '관리자 호출')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function extractMessage(e: unknown, fallback: string): string {
  const res = (e as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = res?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message ?? fallback;
}
