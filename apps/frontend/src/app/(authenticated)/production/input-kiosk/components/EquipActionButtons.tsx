"use client";

/**
 * @file production/input-kiosk/components/EquipActionButtons.tsx
 * @description 설비정지 / 관리자호출 버튼 — 키오스크 우측 컬럼 맨 아래(작업이력 아래)에 놓인다.
 *
 * 초보자 가이드:
 * 1. 헤더에 있던 두 버튼을 그대로 옮긴 것이다(2026-09-19 지시: 우측 제일 하단). 동작·testid·경과시간 표시는 헤더 시절과 같다.
 * 2. 헤더 Row1처럼 폭을 아낄 필요가 없어 라벨을 항상 보여 준다. 진행 중이면 경과시간을 붙인다.
 * 3. 정지/호출 상태와 경과초는 page.tsx의 useEquipStop이 서버 기준으로 준다. 여기서는 그리기만 한다.
 */
import { useTranslation } from 'react-i18next';
import { Square, BellRing } from 'lucide-react';
import { formatElapsed } from '../hooks/useEquipStop';

interface EquipActionButtonsProps {
  /** 설비가 선택돼야 두 버튼이 활성화된다 */
  hasEquip: boolean;
  onOpenEquipStop: () => void;
  onOpenManagerCall: () => void;
  isStopped?: boolean;
  stopElapsed?: number;
  isCalling?: boolean;
  callElapsed?: number;
}

export default function EquipActionButtons({
  hasEquip,
  onOpenEquipStop,
  onOpenManagerCall,
  isStopped = false,
  stopElapsed = 0,
  isCalling = false,
  callElapsed = 0,
}: EquipActionButtonsProps) {
  const { t } = useTranslation();
  const disabledTitle = t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.');

  // pr-20: 우측 하단 플로팅(+) 버튼이 관리자호출 라벨을 가리지 않도록 오른쪽 여백을 둔다
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-t-2 border-border bg-card p-2 pr-20" data-testid="kiosk-equip-actions">
      <button
        type="button"
        data-testid="kiosk-equip-stop-open"
        onClick={onOpenEquipStop}
        disabled={!hasEquip}
        title={hasEquip
          ? `${t('kiosk.equipStop.title', '설비정지')}${isStopped ? ` · ${formatElapsed(stopElapsed)}` : ''}`
          : disabledTitle}
        aria-label={t('kiosk.equipStop.title', '설비정지')}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg border-2 px-3 transition-colors disabled:cursor-not-allowed disabled:border-border disabled:text-black/40 dark:disabled:text-white/40 ${
          isStopped
            ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400'
            : 'border-border text-black/70 hover:border-red-500 hover:text-red-600 dark:text-white/70 dark:hover:border-red-400 dark:hover:text-red-400'
        }`}
      >
        <Square className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap text-sm font-bold">
          {isStopped ? t('kiosk.equipStop.stopping', '정지 중') : t('kiosk.equipStop.title', '설비정지')}
        </span>
        {isStopped && (
          <span data-testid="kiosk-header-stop-elapsed" className="font-mono text-sm font-bold tabular-nums">
            {formatElapsed(stopElapsed)}
          </span>
        )}
      </button>

      <button
        type="button"
        data-testid="kiosk-manager-call-open"
        onClick={onOpenManagerCall}
        disabled={!hasEquip}
        title={hasEquip
          ? `${t('kiosk.managerCall.title', '관리자호출')}${isCalling ? ` · ${formatElapsed(callElapsed)}` : ''}`
          : disabledTitle}
        aria-label={t('kiosk.managerCall.title', '관리자호출')}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg border-2 px-3 transition-colors disabled:cursor-not-allowed disabled:border-border disabled:text-black/40 dark:disabled:text-white/40 ${
          isCalling
            ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400'
            : 'border-border text-black/70 hover:border-amber-500 hover:text-amber-600 dark:text-white/70 dark:hover:border-amber-400 dark:hover:text-amber-400'
        }`}
      >
        <BellRing className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap text-sm font-bold">
          {isCalling ? t('kiosk.managerCall.calling', '호출 중') : t('kiosk.managerCall.title', '관리자호출')}
        </span>
        {isCalling && (
          <span className="font-mono text-sm font-bold tabular-nums">{formatElapsed(callElapsed)}</span>
        )}
      </button>
    </div>
  );
}
