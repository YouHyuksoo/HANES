"use client";

/**
 * @file components/HeaderCheckItem.tsx
 * @description 헤더 점검 상태 카드 — 라벨 + 완료/미완료 상태 + 입력 버튼
 *
 * 초보자 가이드:
 * - 설비일일검사 / 작업자설비검사 / 마스터샘플검사 헤더 표시에 공통 사용
 * - done=true: teal "완료(+상세)" / false: orange "미완료"
 * - notTarget=true: 대상 아님(회색, 입력 버튼 비활성)
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';

interface HeaderCheckItemProps {
  label: string;
  done: boolean;
  doneDetail?: string;
  notTarget?: boolean;
  notTargetDetail?: string;
  disabled?: boolean;
  disabledReason?: string;
  onInput: () => void;
}

export default function HeaderCheckItem({
  label,
  done,
  doneDetail,
  notTarget,
  notTargetDetail,
  disabled,
  disabledReason,
  onInput,
}: HeaderCheckItemProps) {
  const { t } = useTranslation();
  const isDisabled = Boolean(disabled || notTarget);
  const reasonText = notTarget
    ? (notTargetDetail ?? t('kiosk.header.notTarget', '대상 아님'))
    : disabledReason;
  const buttonTitle = isDisabled
    ? (reasonText ?? t('kiosk.header.inputDisabled', '입력할 수 없습니다.'))
    : t('common.input', '입력');
  const reasonId = reasonText ? `check-item-reason-${label.replace(/\W+/g, '-')}` : undefined;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="text-xs font-bold text-text">{label}</div>
        {notTarget ? (
          <div className="truncate text-[11px] italic text-text-muted">
            {notTargetDetail ?? t('kiosk.header.notTarget', '대상 아님')}
          </div>
        ) : done ? (
          <div className="flex items-center gap-1 truncate text-[11px] font-medium text-teal-600 dark:text-teal-400">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            {doneDetail ?? t('kiosk.header.done', '완료')}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-[11px] font-medium text-orange-500">
              <XCircle className="h-3 w-3 shrink-0" />
              {t('kiosk.header.notDone', '미완료')}
            </div>
            {disabledReason && (
              <div
                id={reasonId}
                className="truncate text-[11px] text-text-muted"
                title={disabledReason}
              >
                {disabledReason}
              </div>
            )}
          </>
        )}
        {!notTarget && isDisabled && reasonText && !disabledReason && (
          <div
            id={reasonId}
            className="truncate text-[11px] text-text-muted"
            title={reasonText}
          >
            {reasonText}
          </div>
        )}
      </div>
      <span className="shrink-0" title={buttonTitle}>
        <button
          onClick={onInput}
          disabled={isDisabled}
          aria-describedby={reasonId}
          aria-label={buttonTitle}
          className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
        >
          {t('common.input', '입력')}
        </button>
      </span>
    </div>
  );
}
