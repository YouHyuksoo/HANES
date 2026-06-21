"use client";

/**
 * @file components/SelfInspectPanel.tsx
 * @description 하단 중앙 자주검사 패널 — 시점 트리거(초물·중물·종물) + 검사 이력 리스트
 *
 * 초보자 가이드:
 * - 상단: 초물/중물/종물 3개 버튼 (기존 인터락/시점 로직 그대로 보존)
 *   · 완료=teal, 중물 권장(notify)/차단(block)=amber/red 펄스, 비활성=gray
 * - 하단: GET /production/self-inspect/results/:orderNo 결과를 timing별로 집계해 표시
 *   · 시각 / 구분·검사자 / 판정(전항목 PASS면 OK) / 샘플 수
 * - onOpenSelfInspect(timing): 부모(page.tsx)의 setSelfInspectTiming 호출 → 모달 오픈
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore, isAllInterlockDone, type InspectTiming } from '@/stores/kioskStore';

interface SelfInspectPanelProps {
  onOpenSelfInspect: (timing: InspectTiming) => void;
  firstInspectDone: boolean;
  lastInspectDone: boolean;
  midNotifyPct: number;
  midBlockPct: number;
}

interface ResultRow {
  id: string;
  timing: string;
  status: string;
  inspectorId: string | null;
  sampleNo: number;
  createdAt?: string;
}

interface AggregatedRow {
  timing: string;
  time: string;
  inspector: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  sampleCount: number;
}

function aggregateByTiming(rows: ResultRow[]): AggregatedRow[] {
  const order: Record<string, number> = { FIRST: 0, MID: 1, LAST: 2 };
  const groups = new Map<string, ResultRow[]>();
  rows.forEach((r) => {
    const list = groups.get(r.timing) ?? [];
    list.push(r);
    groups.set(r.timing, list);
  });

  const result: AggregatedRow[] = [];
  groups.forEach((list, timing) => {
    const latest = list.reduce((a, b) =>
      (a.createdAt ?? '') >= (b.createdAt ?? '') ? a : b);
    const status: AggregatedRow['status'] = list.some((r) => r.status === 'FAIL')
      ? 'FAIL'
      : list.some((r) => r.status === 'PENDING')
      ? 'PENDING'
      : 'PASS';
    const sampleCount = new Set(list.map((r) => r.sampleNo)).size;
    result.push({
      timing,
      time: latest.createdAt ? new Date(latest.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }) : '-',
      inspector: latest.inspectorId ?? '-',
      status,
      sampleCount,
    });
  });

  return result.sort((a, b) => (order[a.timing] ?? 9) - (order[b.timing] ?? 9));
}

interface TimingBtnProps {
  timing: InspectTiming;
  label: string;
  done: boolean;
  disabled: boolean;
  disabledReason?: string;
  notify?: boolean;
  block?: boolean;
  onClick: () => void;
}

function TimingBtn({ timing, label, done, disabled, disabledReason, notify, block, onClick }: TimingBtnProps) {
  const { t } = useTranslation();
  const tone: Record<InspectTiming, string> = {
    FIRST: 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300',
    MID: 'border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300',
    LAST: 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-300',
  };
  const cls = done
    ? 'border-teal-400 dark:border-teal-600 text-teal-700 dark:text-teal-300 bg-card'
    : block
    ? 'border-red-500 text-red-600 dark:text-red-400 bg-card animate-pulse'
    : notify
    ? 'border-amber-400 text-amber-600 dark:text-amber-400 bg-card animate-pulse'
    : disabled
    ? 'border-border text-text-muted opacity-50 cursor-not-allowed'
    : `${tone[timing]} bg-card hover:opacity-80`;

  return (
    <button
      onClick={onClick}
      disabled={disabled && !done}
      title={done ? label : (disabledReason || label)}
      className={`flex flex-col items-center gap-0.5 rounded border-2 px-1 py-1 text-xs font-semibold transition-all ${cls}`}
    >
      <span>{label}</span>
      {done ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : block ? (
        <span className="text-[9px] font-bold">{t('kiosk.selfInspect.blockBadge', '차단!')}</span>
      ) : notify ? (
        <span className="text-[9px] font-bold">{t('kiosk.selfInspect.notifyBadge', '권장↑')}</span>
      ) : (
        <FlaskConical className="h-3 w-3 opacity-60" />
      )}
      {!done && disabled && disabledReason ? (
        <span className="text-[9px] text-text-muted leading-none" title={disabledReason}>
          {disabledReason}
        </span>
      ) : null}
    </button>
  );
}

export default function SelfInspectPanel({
  onOpenSelfInspect,
  firstInspectDone,
  lastInspectDone,
  midNotifyPct,
  midBlockPct,
}: SelfInspectPanelProps) {
  const { t } = useTranslation();
  const { selectedJobOrder, interlock, savedResultCount, midInspectDone } = useKioskStore();
  const [rows, setRows] = useState<AggregatedRow[]>([]);

  const orderNo = selectedJobOrder?.orderNo;
  const allInterlockDone = isAllInterlockDone(interlock);
  const planQty = selectedJobOrder?.planQty ?? 0;
  const progressPct = planQty > 0 ? (savedResultCount / planQty) * 100 : 0;

  const firstDisabledReason = !allInterlockDone
    ? t('kiosk.prep.checkRequired')
    : '';
  const midDisabledReason = progressPct >= midBlockPct && !midInspectDone
    ? t('kiosk.selfInspect.midBlock')
    : !allInterlockDone
      ? t('kiosk.prep.checkRequired')
      : allInterlockDone && !firstInspectDone
        ? t('kiosk.selfInspect.first')
        : '';
  const lastDisabledReason = !allInterlockDone
    ? t('kiosk.prep.checkRequired')
    : !firstInspectDone
      ? t('kiosk.selfInspect.first')
      : '';

  useEffect(() => {
    if (!orderNo) { setRows([]); return; }
    api.get(`/production/self-inspect/results/${orderNo}`)
      .then((res) => setRows(aggregateByTiming(res.data?.data ?? [])))
      .catch(() => setRows([]));
  }, [orderNo, firstInspectDone, midInspectDone, lastInspectDone]);

  const statusLabel: Record<AggregatedRow['status'], { text: string; cls: string }> = {
    PASS: { text: 'OK', cls: 'text-green-600 dark:text-green-400' },
    FAIL: { text: 'FAIL', cls: 'text-red-600 dark:text-red-400' },
    PENDING: { text: t('kiosk.selfInspect.pending', '대기'), cls: 'text-amber-600 dark:text-amber-400' },
  };

  const timingLabel: Record<string, string> = {
    FIRST: t('kiosk.selfInspect.first'),
    MID: t('kiosk.selfInspect.mid'),
    LAST: t('kiosk.selfInspect.last'),
  };

  return (
    <div className="flex h-full flex-col gap-1.5 p-2">
      {/* 헤더: 제목 + 시점 트리거 */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-bold text-text">
          <FlaskConical className="h-3.5 w-3.5 text-primary" />
          {t('kiosk.selfInspect.title')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <TimingBtn
          timing="FIRST"
          label={t('kiosk.selfInspect.first')}
          done={firstInspectDone}
          disabled={!allInterlockDone}
          disabledReason={firstDisabledReason}
          onClick={() => onOpenSelfInspect('FIRST')}
        />
        <TimingBtn
          timing="MID"
          label={t('kiosk.selfInspect.mid')}
          done={midInspectDone}
          disabled={!allInterlockDone || !firstInspectDone}
          disabledReason={midDisabledReason}
          notify={progressPct >= midNotifyPct && !midInspectDone}
          block={progressPct >= midBlockPct && !midInspectDone}
          onClick={() => onOpenSelfInspect('MID')}
        />
        <TimingBtn
          timing="LAST"
          label={t('kiosk.selfInspect.last')}
          done={lastInspectDone}
          disabled={!allInterlockDone || !firstInspectDone}
          disabledReason={lastDisabledReason}
          onClick={() => onOpenSelfInspect('LAST')}
        />
      </div>

      {/* 검사 이력 리스트 */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-border bg-surface/40">
        <div className="grid grid-cols-[42px_1fr_46px_36px] gap-1 border-b border-border px-2 py-1 text-[10px] font-semibold text-text-muted">
          <span>{t('kiosk.selfInspect.colTime', '시각')}</span>
          <span>{t('kiosk.selfInspect.colType', '구분/검사자')}</span>
          <span className="text-center">{t('kiosk.selfInspect.colJudge', '판정')}</span>
          <span className="text-right">{t('kiosk.selfInspect.colSample', '샘플')}</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-2 py-4 text-center text-[11px] text-text-muted">
            {t('kiosk.selfInspect.noHistory', '검사 이력 없음')}
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.timing}
              className="grid grid-cols-[42px_1fr_46px_36px] gap-1 border-b border-border/40 px-2 py-1 text-[11px] last:border-b-0"
            >
              <span className="tabular-nums text-text-muted">{r.time}</span>
              <span className="truncate text-text">
                {timingLabel[r.timing] ?? r.timing}
                {r.inspector !== '-' && <span className="text-text-muted"> · {r.inspector}</span>}
              </span>
              <span className={`text-center font-bold ${statusLabel[r.status].cls}`}>
                {statusLabel[r.status].text}
              </span>
              <span className="text-right tabular-nums text-text">{r.sampleCount}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
