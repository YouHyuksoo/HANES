"use client";

/**
 * @file input-kiosk/components/ManagerCallModal.tsx
 * @description 관리자호출 팝업 — 호출 등록 전용(현장)
 *
 * 초보자 가이드:
 * 1. 관리자호출은 **작업을 멈추지 않는다**. 실적입력을 막지 않고, 호출 기록만 남긴다.
 *    (작업을 멈춰야 하면 설비정지를 따로 등록한다.)
 * 2. 호출 유형(설비이상/품질문의/자재요청/기타)과 내용을 적어 등록하면 팝업은 바로 닫힌다.
 * 3. 호출 중에는 헤더 배지에 "호출중 + 대기시간"이 계속 보인다.
 * 4. **응대 완료(해제)는 현장에서 하지 않는다.** 관리자가 설비모니터링(설비가동 보드)에서
 *    호출 목록을 보고 "응대 완료"를 눌러 해제한다.
 *
 * 레이아웃 규칙(EquipStopModal 과 동일):
 * - 본문은 카드 섹션으로 구분, 주 액션은 하단 푸터 중앙 1개, 닫기는 하단 왼쪽 귀퉁이.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing } from 'lucide-react';
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
}

const DEFAULT_CALL_TYPE = 'EQUIP';

/** 섹션 카드 — 데이터 묶음 사이의 경계를 눈에 보이게 한다. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background/40">
      <header className="border-b border-border px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-black/60 dark:text-white/60">
          {title}
        </span>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export default function ManagerCallModal({
  isOpen, onClose, equipCode, equipName,
  openCall, callElapsed, loading, onCall,
}: ManagerCallModalProps) {
  const { t } = useTranslation();
  const [callType, setCallType] = useState(DEFAULT_CALL_TYPE);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCallType(openCall?.callType ?? DEFAULT_CALL_TYPE);
    setRemark(openCall?.callRemark ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, openCall?.callId]);

  const handleCall = async () => {
    setError(null);
    try {
      await onCall(callType, remark);
      onClose(); // 호출은 등록만 하고 바로 빠진다. 작업 화면을 붙잡지 않는다.
    } catch (e: unknown) {
      setError(extractMessage(e, t('kiosk.managerCall.callFailed', '관리자호출 등록에 실패했습니다.')));
    }
  };

  // 호출 중이면 대기 상태만 보여준다. 해제는 관리자가 설비모니터링에서 한다.
  const footer = (
    <div className="relative flex w-full items-center justify-center">
      <Button variant="ghost" onClick={onClose} className="absolute left-0">
        {t('common.close')}
      </Button>
      {!openCall && (
        <Button
          variant="primary"
          size="lg"
          disabled={!equipCode || !callType || loading}
          onClick={handleCall}
          data-testid="kiosk-call-create"
          className="min-w-[220px]"
        >
          <BellRing className="mr-2 h-5 w-5" />
          {t('kiosk.managerCall.call', '관리자 호출')}
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      footer={footer}
      title={`${t('kiosk.managerCall.title', '관리자호출')}${equipName ? ` · ${equipName}` : ''}`}
    >
      <div className="space-y-4">
        {openCall ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-amber-500 bg-amber-500/5 py-5 dark:border-amber-400">
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
            <span className="mt-1 rounded bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {t(
                'kiosk.managerCall.waitingHint',
                '관리자가 설비모니터링에서 응대 완료를 누르면 해제됩니다. 작업은 계속 진행하세요.',
              )}
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-5 text-center text-sm text-black/60 dark:text-white/60">
            {t(
              'kiosk.managerCall.idleHint',
              '도움이 필요한 유형과 내용을 적어 호출하세요. 호출해도 작업은 멈추지 않습니다(설비를 멈춰야 하면 설비정지를 등록하세요).',
            )}
          </div>
        )}

        <Section title={t('kiosk.managerCall.inputSection', '호출 내용')}>
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 pb-3">
              <label className="text-sm font-semibold text-black/70 dark:text-white/70">
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
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 pt-3">
              <label className="text-sm font-semibold text-black/70 dark:text-white/70">
                {t('kiosk.managerCall.remark', '호출 내용')}
              </label>
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={t('kiosk.managerCall.remarkPlaceholder', '어떤 도움이 필요한지')}
                maxLength={500}
                disabled={Boolean(openCall)}
                fullWidth
              />
            </div>
          </div>
        </Section>

        {error && (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
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
