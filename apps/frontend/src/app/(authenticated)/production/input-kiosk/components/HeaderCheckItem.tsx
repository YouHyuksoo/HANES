"use client";

/**
 * @file components/HeaderCheckItem.tsx
 * @description 헤더 점검 상태 카드 — 라벨 + 완료/미완료 상태 + 입력 버튼
 *
 * 초보자 가이드:
 * - 설비일일검사 / 작업자설비검사 헤더 표시에 공통 사용
 * - done=true: 초록 / false: 빨강 / notTarget: 회색
 * - 상태 구분은 **왼쪽 굵은 세로 보더 + 상태 문구 색 + 입력 버튼 톤** 세 가지를 같이 쓴다.
 *   작은 아이콘 하나로만 갈리던 때는 현장에서 완료와 미완료가 구분되지 않았다(2026-09-14 지적).
 *   카드 배경에 파스텔을 깔지 않는다 — 테두리와 텍스트로만 구분하는 것이 이 프로젝트 규칙이다.
 * - 끝난 점검은 입력 버튼을 outline 으로 낮춘다. 남은 일만 primary 로 도드라지게 둔다.
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
  /** 시나리오 드라이버가 입력 버튼을 집는다 */
  testId?: string;
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
  testId,
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

  // 상태축 하나로 테두리·문구색·버튼톤을 함께 정한다. 세 군데가 따로 놀면 또 헷갈린다.
  const tone = notTarget ? 'muted' : done ? 'done' : 'todo';
  const edgeCls = {
    done: 'border-l-4 border-l-green-600 dark:border-l-green-400',
    todo: 'border-l-4 border-l-red-500 dark:border-l-red-400',
    muted: 'border-l-4 border-l-border',
  }[tone];
  const statusCls = {
    done: 'text-green-700 dark:text-green-400',
    todo: 'text-red-600 dark:text-red-400',
    muted: 'text-black/50 dark:text-white/50',
  }[tone];

  return (
    <div
      className={`flex h-11 shrink-0 items-center justify-between gap-2 rounded-lg border border-border ${edgeCls} bg-card pl-2 pr-2.5 ${wide ? 'w-48' : 'w-36'}`}
      title={isDisabled ? (reasonText ?? '') : ''}
    >
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-bold leading-tight ${notTarget ? 'text-black/50 dark:text-white/50' : 'text-black dark:text-white'}`}>{label}</div>
        {notTarget ? (
          <div className={`text-[11px] leading-tight ${statusCls}`}>
            {t('kiosk.header.notTarget', '대상 아님')}
          </div>
        ) : done ? (
          <div className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-bold leading-tight ${statusCls}`}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {doneDetail ?? t('kiosk.header.done', '완료')}
          </div>
        ) : (
          <div className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-bold leading-tight ${statusCls}`}>
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            {notDoneDetail ?? t('kiosk.header.notDone', '미완료')}
          </div>
        )}
      </div>
      <button
        onClick={onInput}
        disabled={isDisabled}
        data-testid={testId}
        aria-describedby={reasonId}
        aria-label={buttonTitle}
        title={buttonTitle}
        className={`shrink-0 rounded px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-transparent disabled:text-black/40 dark:disabled:text-white/40 ${
          done
            // 끝난 점검은 다시 볼 수만 있으면 된다. 남은 일과 같은 무게로 두지 않는다.
            ? 'border border-border bg-transparent text-black/70 hover:border-primary hover:text-primary dark:text-white/70'
            : 'bg-primary text-white hover:bg-primary/90'
        } ${!done && !isDisabled ? 'animate-pulse' : ''}`}
      >
        {done ? t('common.view', '보기') : t('common.input', '입력')}
      </button>
    </div>
  );
}
