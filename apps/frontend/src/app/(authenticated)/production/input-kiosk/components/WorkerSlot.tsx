"use client";

/**
 * @file components/WorkerSlot.tsx
 * @description 실적입력 3화면(가공·서브조립·조립) 공용 작업자 슬롯
 *
 * - 배정된 작업자를 칩으로 나열하고 각 칩에서 제거할 수 있다.
 * - 작업자 추가 버튼은 설비를 먼저 고르기 전엔 잠기고, 설비는 있는데 작업자가 없으면 깜빡이며 빨간 보더로 경고한다.
 * - 배경 파스텔은 쓰지 않고 왼쪽 굵은 세로 보더로만 상태를 알린다(점검 카드와 같은 신호).
 * - 좁은 화면에서는 아이콘만 남기고 2xl+ 에서 라벨을 펼친다.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle, UserPlus, X } from 'lucide-react';
import type { Worker } from '@/components/worker/WorkerSelector';

export interface WorkerSlotProps {
  workers: Worker[];
  /** 설비가 선택돼 있는지 — 없으면 추가 버튼을 잠그고 경고도 띄우지 않는다 */
  hasEquip: boolean;
  /** 화면 잠금(처리 중 등)으로 추가·제거를 막을 때 */
  locked?: boolean;
  onOpenWorker: () => void;
  onRemoveWorker: (workerId: string) => void;
}

export default function WorkerSlot({ workers, hasEquip, locked = false, onOpenWorker, onRemoveWorker }: WorkerSlotProps) {
  const { t } = useTranslation();
  const canEdit = hasEquip && !locked;

  return (
    <div data-testid="kiosk-worker-region" className={`flex min-h-11 min-w-0 flex-wrap items-center gap-1.5 py-1.5 rounded-lg border border-border bg-card pl-2 pr-1.5 2xl:pr-3 ${
      workers.length > 0
        ? 'border-l-4 border-l-green-600 dark:border-l-green-400'
        : hasEquip
          ? 'border-l-4 border-l-red-500 dark:border-l-red-400'
          : 'border-l-4 border-l-border'
    }`}>
      <UserPlus className="h-4 w-4 shrink-0 text-primary" />
      {workers.map(w => (
        <span key={w.id} className="inline-flex items-center gap-1 rounded-full border border-green-600 px-2 py-0.5 text-xs font-bold text-green-700 dark:border-green-400 dark:text-green-400">
          <CheckCircle className="h-3 w-3 shrink-0" />
          <span className="max-w-[64px] truncate 2xl:max-w-none" title={w.workerName}>{w.workerName}</span>
          <button onClick={() => onRemoveWorker(w.id)} disabled={locked} aria-label={t('common.delete')} className="ml-0.5 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button data-testid="kiosk-worker-open" onClick={onOpenWorker} disabled={!canEdit}
        title={hasEquip ? t('kiosk.header.addWorker') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
        aria-label={t('kiosk.header.addWorker')}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center gap-1 rounded bg-primary py-1 text-xs font-semibold text-white 2xl:h-auto 2xl:w-auto 2xl:px-2.5 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-black/60 dark:text-white/60 ${canEdit && workers.length === 0 ? 'animate-pulse' : ''}`}>
        <UserPlus className="h-3.5 w-3.5 shrink-0 2xl:h-3 2xl:w-3" />
        <span className="hidden 2xl:inline">{t('kiosk.header.addWorker')}</span>
      </button>
      {workers.length === 0 && hasEquip && (
        <span className="flex items-center gap-1 whitespace-nowrap text-xs font-bold text-red-600 dark:text-red-400" title={t('kiosk.header.workerRequired')}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden 2xl:inline">{t('kiosk.header.workerRequired')}</span>
        </span>
      )}
    </div>
  );
}
