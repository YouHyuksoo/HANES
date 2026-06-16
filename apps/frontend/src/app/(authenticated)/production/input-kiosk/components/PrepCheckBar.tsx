"use client";

/**
 * @file components/PrepCheckBar.tsx
 * @description 준비단계 인터락 체크 바 — 상단 헤더 아래 표시
 *
 * 초보자 가이드:
 * 4가지 준비 조건을 왼쪽→오른쪽 순서로 표시
 *   ① 설비일일점검 — 1일 1회, 설비 담당 (API 체크)
 *   ② 작업자설비점검 — 작업지시 변경 시, 작업자 자가 확인 (모달 체크)
 *   ③ 자재 바코드 스캔 — BOM 자재 전체 스캔 확인
 *   ④ 소모성 부품 스캔 — 장착된 소모품 전체 스캔 확인
 * 모두 완료(녹색)여야 실적 입력 버튼 활성화
 */
import { CheckCircle2, XCircle, ChevronRight, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useKioskStore, isAllInterlockDone } from '@/stores/kioskStore';

interface PrepCheckBarProps {
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onOpenMaterialScan: () => void;
  onOpenConsumableScan: () => void;
}

interface CheckItemProps {
  label: string;
  done: boolean;
  disabled?: boolean;
  onClick: () => void;
  step: number;
  disabledReason?: string;
}

function CheckItem({
  label,
  done,
  disabled,
  onClick,
  step,
  disabledReason,
}: CheckItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || done}
      title={done ? label : (disabledReason || label)}
      className={[
        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-all border',
        done
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 cursor-default'
          : disabled
          ? 'bg-surface border-border text-text-muted opacity-50 cursor-not-allowed'
          : 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 cursor-pointer animate-pulse',
      ].join(' ')}
    >
      <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold shrink-0">
        {step}
      </span>
      {done
        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        : <XCircle className="w-4 h-4 text-orange-500 shrink-0" />}
      <span className="whitespace-nowrap">{label}</span>
      {disabled && disabledReason && (
        <span className="text-[10px] text-text-muted truncate" title={disabledReason}>
          {disabledReason}
        </span>
      )}
    </button>
  );
}

export default function PrepCheckBar({
  onOpenDailyInspect,
  onOpenWorkerInspect,
  onOpenMaterialScan,
  onOpenConsumableScan,
}: PrepCheckBarProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder, selectedWorkers, interlock } = useKioskStore();
  const allDone = isAllInterlockDone(interlock);
  const hasEquip = !!selectedEquip;
  const hasJobOrder = !!selectedJobOrder;
  const dailyReason = !hasEquip
    ? t('kiosk.header.selectEquip')
    : '';
  const workerReason = !interlock.dailyInspectDone
    ? t('kiosk.header.dailyInspectRequired', '설비일일점검을 먼저 완료하세요.')
    : !hasJobOrder
      ? t('kiosk.header.selectJobOrderFirst', '작업지시를 먼저 선택하세요.')
    : selectedWorkers.length === 0
      ? t('kiosk.header.workerRequiredForInspect', '작업자를 1명 이상 추가하세요.')
      : '';
  const materialReason = !interlock.workerInspectDone
    ? t('kiosk.prep.workerInspect')
    : !hasJobOrder
      ? t('kiosk.header.selectJobOrder')
      : '';
  const consumableReason = interlock.materialScanDone
    ? ''
    : t('kiosk.input.disabledReasons.materialScan');

  if (!hasEquip) return null;

  return (
    <div className={[
      'flex items-center gap-2 px-4 py-2 border-b text-xs flex-shrink-0',
      allDone
        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
        : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
    ].join(' ')}>

      {/* 상태 아이콘 */}
      {allDone ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0 animate-pulse" />
      )}

      <span className={`font-semibold mr-1 ${allDone ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
        {allDone ? t('kiosk.prep.allDone') : t('kiosk.prep.checkRequired')}
      </span>

      {/* 구분선 */}
      <div className="w-px h-5 bg-border/60 mx-1" />

      {/* ① 설비일일점검 */}
      <CheckItem
        step={1}
        label={t('kiosk.prep.dailyInspect')}
        done={interlock.dailyInspectDone}
        disabled={!hasEquip}
        disabledReason={dailyReason}
        onClick={onOpenDailyInspect}
      />

      <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />

      {/* ② 작업자설비점검 */}
      <CheckItem
        step={2}
        label={t('kiosk.prep.workerInspect')}
        done={interlock.workerInspectDone}
        disabled={!interlock.dailyInspectDone || !hasJobOrder || selectedWorkers.length === 0}
        disabledReason={workerReason}
        onClick={onOpenWorkerInspect}
      />

      <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />

      {/* ③ 자재 바코드 스캔 */}
      <CheckItem
        step={3}
        label={t('kiosk.prep.materialScan')}
        done={interlock.materialScanDone}
        disabled={!interlock.workerInspectDone || !hasJobOrder}
        disabledReason={materialReason}
        onClick={onOpenMaterialScan}
      />

      <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />

      {/* ④ 소모성 부품 스캔 */}
      <CheckItem
        step={4}
        label={t('kiosk.prep.consumableScan')}
        done={interlock.consumableScanDone}
        disabled={!interlock.materialScanDone}
        disabledReason={consumableReason}
        onClick={onOpenConsumableScan}
      />

      {allDone && (
        <>
          <div className="w-px h-5 bg-border/60 mx-1" />
          <span className="text-green-600 dark:text-green-400 font-medium">
            {t('kiosk.prep.readyToWork')}
          </span>
        </>
      )}
    </div>
  );
}
