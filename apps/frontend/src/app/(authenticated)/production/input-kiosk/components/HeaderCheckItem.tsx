"use client";

/**
 * @file components/HeaderCheckItem.tsx
 * @description 헤더 점검 상태 카드 — 라벨 + 완료/미완료 상태 + 입력 버튼
 *
 * 초보자 가이드:
 * - 설비일일검사 / 작업자설비검사 헤더 표시에 공통 사용
 * - done=true: teal "완료(+상세)" / false: orange "미완료"
 * - notTarget=true: 대상 아님(회색, 입력 버튼 비활성)
 * - notDoneDetail: 미완료 사유를 대체 문구로 표시 (예: 점검은 했으나 종합판정 NG)
 *   점검을 완료했지만 종합판정이 불합격이면 done=false + notDoneDetail='완료·NG'로 표현한다.
 *   배지가 초록인데 작업은 막히는 모순을 만들지 않기 위해 done은 "진행 가능"의 의미로 유지한다.
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';

interface HeaderCheckItemProps {
  label: string;
  done: boolean;
  doneDetail?: string;
  notDoneDetail?: string;
  notTarget?: boolean;
  notTargetDetail?: string;
  disabled?: boolean;
  disabledReason?: string;
  onInput: () => void;
  wide?: boolean;
}

export default function HeaderCheckItem({
  label,
  done,
  doneDetail,
  notDoneDetail,
  notTarget,
  notTargetDetail,
  disabled,
  disabledReason,
  onInput,
  wide = false,
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
    <div
      className={`flex h-11 shrink-0 items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 ${wide ? 'w-48' : 'w-36'}`}
      title={isDisabled ? (reasonText ?? '') : ''}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-black dark:text-white leading-tight">{label}</div>
        {notTarget ? (
          <div className="text-[11px] text-black/50 dark:text-white/50 leading-tight">
            {t('kiosk.header.notTarget', '대상 아님')}
          </div>
        ) : done ? (
          <div className="flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-black dark:text-white leading-tight">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
            {doneDetail ?? t('kiosk.header.done', '완료')}
          </div>
        ) : (
          <div className="flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-black dark:text-white leading-tight">
            <XCircle className="h-3 w-3 shrink-0 text-red-500" />
            {notDoneDetail ?? t('kiosk.header.notDone', '미완료')}
          </div>
        )}
      </div>
      <button
        onClick={onInput}
        disabled={isDisabled}
        aria-describedby={reasonId}
        aria-label={buttonTitle}
        title={buttonTitle}
        className={`shrink-0 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-black/40 ${!done && !isDisabled ? 'animate-pulse' : ''}`}
      >
        {t('common.input', '입력')}
      </button>
    </div>
  );
}
