"use client";

/**
 * @file components/inspect/HeaderCheckItem.tsx
 * @description 헤더 점검 상태 카드 (공용) — 라벨 + 완료/미완료 상태 + 입력 버튼
 *
 * 실적입력(가공) 키오스크와 통전·단자검사가 같은 카드를 쓴다. 두 화면의 점검 UI를 갈라놓지 않는다.
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
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';

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
  /** 고정폭(w-36/w-48) 대신 부모 flex 안에서 남는 폭을 채운다. 좁은 열에 두 장을 나란히 둘 때 글자가 접히지 않게 한다. */
  fluid?: boolean;
  /** 시나리오 드라이버가 입력 버튼을 집는다 */
  testId?: string;
  /**
   * 화면이 좁아지면(2xl 미만) 카드를 아이콘 버튼 하나로 접는다.
   * 키오스크 헤더처럼 한 줄에 고정폭 요소가 많은 화면에서 쓴다.
   */
  responsiveCompact?: boolean;
  /** 접힌 상태에서 쓸 아이콘. 없으면 ClipboardCheck */
  icon?: ComponentType<{ className?: string }>;
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
  fluid = false,
  testId,
  responsiveCompact = false,
  icon: Icon = ClipboardCheck,
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

  // 접힌(아이콘) 모드의 툴팁·aria 문구. 라벨 + 상태 + (막힌 경우) 사유를 한 줄로 합친다.
  const statusText = notTarget
    ? (notTargetDetail ?? t('kiosk.header.notTarget', '대상 아님'))
    : done
      ? (doneDetail ?? t('kiosk.header.done', '완료'))
      : (notDoneDetail ?? t('kiosk.header.notDone', '미완료'));
  const compactTitle = [label, statusText, isDisabled ? reasonText : null].filter(Boolean).join(' · ');
  const compactToneCls = {
    done: 'border-green-600 text-green-700 dark:border-green-400 dark:text-green-400',
    todo: 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-400',
    muted: 'border-border text-black/50 dark:text-white/50',
  }[tone];

  const fullCard = (
    <div
      className={`flex h-11 shrink-0 items-center justify-between gap-2 rounded-lg border border-border ${edgeCls} bg-card pl-2 pr-2.5 ${fluid ? 'min-w-0 flex-1' : wide ? 'w-48' : 'w-36'}`}
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

  if (!responsiveCompact) return fullCard;

  // 좁은 화면: 아이콘 버튼 하나로 접는다. 상태는 테두리·아이콘 색 + 우상단 점으로만 알린다.
  // 넓은 화면(2xl+): 2xl:contents 로 래퍼를 투명하게 만들어 기존 카드 레이아웃을 그대로 유지한다.
  return (
    <>
      <button
        type="button"
        onClick={onInput}
        disabled={isDisabled}
        data-testid={testId ? `${testId}-compact` : undefined}
        aria-label={compactTitle}
        title={compactTitle}
        className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 bg-card transition-colors disabled:cursor-not-allowed disabled:border-border disabled:text-black/40 dark:disabled:text-white/40 2xl:hidden ${compactToneCls} ${!done && !isDisabled ? 'animate-pulse' : ''}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!notTarget && (
          done
            ? <CheckCircle2 className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-card text-green-600 dark:text-green-400" />
            : <XCircle className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-card text-red-500 dark:text-red-400" />
        )}
      </button>
      <div className="hidden 2xl:contents">{fullCard}</div>
    </>
  );
}
