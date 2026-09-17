"use client";

/**
 * @file input-kiosk/components/EquipStopModal.tsx
 * @description 설비정지 팝업 — 정지 등록 / 경과시간 / 사유 확정 / 해제
 *
 * 초보자 가이드:
 * 1. 정지 전: 사유를 고르거나(선택) 비워둔 채 "설비정지"를 누르면 정지가 시작된다(사유미정 허용).
 * 2. 정지 중: 경과시간이 큰 숫자로 흐른다. 이 시간이 그대로 유실시간이 된다.
 *    사유가 미정이면 해제 버튼이 잠기고, 사유를 고르면 열린다.
 * 3. 팝업을 닫아도 정지는 유지된다. 헤더 배지에 "정지중 HH:MM:SS"가 계속 보인다.
 * 4. 하단에 당일 정지 이력과 유실시간 합계를 보여준다.
 *
 * 레이아웃 규칙(키오스크 가독성):
 * - 본문은 "상태 / 입력 / 당일 이력" 3개 카드 섹션으로만 나눈다. 섹션 사이에 경계선을 둔다.
 * - 주 액션(정지 등록 / 정지 해제)은 하단 푸터 중앙에 1개만 크게 둔다.
 * - 닫기는 하단 왼쪽 귀퉁이(+ 상단 우측 X)로만 둔다. 주 액션 옆에 붙이지 않는다.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Play, Square } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ComCodeSelect from '@/components/shared/ComCodeSelect';
import { useComCodeLabel } from '@/hooks/useComCode';
import { formatElapsed, formatDuration, type EquipStopEvent, type EquipStopSummary } from '../hooks/useEquipStop';

interface EquipStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipCode?: string | null;
  equipName?: string | null;
  openStop: EquipStopEvent | null;
  stopElapsed: number;
  history: EquipStopEvent[];
  summary: EquipStopSummary;
  loading: boolean;
  onStart: (stopReason?: string, stopRemark?: string) => Promise<void>;
  onUpdateReason: (stopId: number, stopReason: string, stopRemark?: string) => Promise<void>;
  onRelease: (stopId: number, stopReason?: string, releaseRemark?: string) => Promise<void>;
  onRefreshHistory: () => void;
}

/** 섹션 카드 — 데이터 묶음 사이의 경계를 눈에 보이게 한다. */
function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/40">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-black/60 dark:text-white/60">
          {title}
        </span>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export default function EquipStopModal({
  isOpen, onClose, equipCode, equipName,
  openStop, stopElapsed, history, summary, loading,
  onStart, onUpdateReason, onRelease, onRefreshHistory,
}: EquipStopModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [releaseRemark, setReleaseRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 팝업을 열 때마다 현재 정지의 사유/비고를 화면에 맞춘다.
  useEffect(() => {
    if (!isOpen) return;
    setReason(openStop?.stopReason ?? '');
    setRemark(openStop?.stopRemark ?? '');
    setReleaseRemark('');
    setError(null);
    onRefreshHistory();
    // openStop.stopId 가 바뀔 때만 초기화한다(경과시간 1초 틱마다 초기화되면 입력이 지워진다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, openStop?.stopId]);

  const handleStart = async () => {
    setError(null);
    try {
      await onStart(reason, remark);
    } catch (e: unknown) {
      setError(extractMessage(e, t('kiosk.equipStop.startFailed', '설비정지 등록에 실패했습니다.')));
    }
  };

  const handleRelease = async () => {
    if (!openStop) return;
    setError(null);
    try {
      if (reason && reason !== openStop.stopReason) {
        await onUpdateReason(openStop.stopId, reason, remark);
      }
      await onRelease(openStop.stopId, reason, releaseRemark);
      onClose();
    } catch (e: unknown) {
      setError(extractMessage(e, t('kiosk.equipStop.releaseFailed', '설비정지 해제에 실패했습니다.')));
    }
  };

  const canRelease = Boolean(openStop) && Boolean(reason);

  // 푸터: 닫기는 왼쪽 귀퉁이, 주 액션은 정중앙 1개.
  const footer = (
    <div className="relative flex w-full items-center justify-center">
      <Button
        variant="ghost"
        onClick={onClose}
        className="absolute left-0"
      >
        {t('common.close')}
      </Button>

      {openStop ? (
        <Button
          variant="primary"
          size="lg"
          disabled={!canRelease || loading}
          onClick={handleRelease}
          data-testid="kiosk-stop-release"
          className="min-w-[220px]"
          title={canRelease ? undefined : t('kiosk.equipStop.reasonRequired', '정지사유를 선택해야 해제할 수 있습니다.')}
        >
          <Play className="mr-2 h-5 w-5" />
          {t('kiosk.equipStop.release', '정지 해제')}
        </Button>
      ) : (
        <Button
          variant="danger"
          size="lg"
          disabled={!equipCode || loading}
          onClick={handleStart}
          data-testid="kiosk-stop-start"
          className="min-w-[220px]"
        >
          <Square className="mr-2 h-5 w-5" />
          {t('kiosk.equipStop.start', '설비정지 등록')}
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      footer={footer}
      title={`${t('kiosk.equipStop.title', '설비정지')}${equipName ? ` · ${equipName}` : ''}`}
    >
      <div className="space-y-4">
        {/* 1) 상태 — 정지 중이면 경과시간, 아니면 안내 */}
        {openStop ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-red-500 bg-red-500/5 py-5 dark:border-red-400">
            <span className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {t('kiosk.equipStop.stopping', '정지 중')}
            </span>
            <span
              data-testid="kiosk-stop-elapsed"
              className="font-mono text-6xl font-extrabold tabular-nums leading-none text-red-600 dark:text-red-400"
            >
              {formatElapsed(stopElapsed)}
            </span>
            <span className="text-xs text-black/60 dark:text-white/60">
              {t('kiosk.equipStop.startedAt', '정지 시각')} {openStop.startedAt}
              {openStop.startedBy ? ` · ${openStop.startedBy}` : ''}
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-5 text-center text-sm text-black/60 dark:text-white/60">
            {t('kiosk.equipStop.idleHint', '설비가 멈추면 사유를 고르고(또는 비워둔 채) 정지를 등록하세요. 등록 시각부터 유실시간이 쌓입니다.')}
          </div>
        )}

        {/* 2) 입력 — 사유 / 비고 / 조치 내용 */}
        <Section
          title={t('kiosk.equipStop.inputSection', '정지 정보')}
          right={
            openStop && !openStop.stopReason && !reason ? (
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                {t('kiosk.equipStop.reasonUndecided', '사유미정 — 해제하려면 사유를 선택하세요')}
              </span>
            ) : undefined
          }
        >
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 pb-3">
              <label className="text-sm font-semibold text-black/70 dark:text-white/70">
                {t('kiosk.equipStop.reason', '정지사유')}
              </label>
              <ComCodeSelect
                groupCode="EQUIP_STOP_REASON"
                includeAll={false}
                value={reason}
                onChange={(v) => setReason(v)}
                placeholder={t('kiosk.equipStop.reasonPlaceholder', '사유 선택(미정 가능)')}
                fullWidth
              />
            </div>

            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-3">
              <label className="text-sm font-semibold text-black/70 dark:text-white/70">
                {t('kiosk.equipStop.remark', '정지 비고')}
              </label>
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                fullWidth
                placeholder={t('kiosk.equipStop.remarkPlaceholder', '현상/조치 메모')}
                maxLength={500}
              />
            </div>

            {openStop && (
              <div className="grid grid-cols-[110px_1fr] items-center gap-3 pt-3">
                <label className="text-sm font-semibold text-black/70 dark:text-white/70">
                  {t('kiosk.equipStop.releaseRemark', '조치 내용')}
                </label>
                <Input
                  value={releaseRemark}
                  onChange={(e) => setReleaseRemark(e.target.value)}
                  fullWidth
                  placeholder={t('kiosk.equipStop.releaseRemarkPlaceholder', '어떤 조치로 재가동했는지')}
                  maxLength={500}
                />
              </div>
            )}
          </div>
        </Section>

        {/* 3) 당일 이력 + 유실시간 집계 */}
        <Section
          title={t('kiosk.equipStop.todayHistory', '당일 정지 이력')}
          right={
            <span className="flex items-center gap-2 text-xs">
              <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                {t('kiosk.equipStop.todayCount', '건수')}{' '}
                <b className="tabular-nums">{summary.stopCount}</b>
              </span>
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">
                {t('kiosk.equipStop.todayLoss', '유실시간')}{' '}
                <b className="tabular-nums">{formatDuration(summary.totalLossSeconds)}</b>
              </span>
            </span>
          }
        >
          <div className="max-h-48 overflow-auto rounded border border-border">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-black/60 dark:text-white/60">
                  <th className="border-b border-r border-border px-2 py-1.5 font-semibold">
                    {t('kiosk.equipStop.colStarted', '정지')}
                  </th>
                  <th className="border-b border-r border-border px-2 py-1.5 font-semibold">
                    {t('kiosk.equipStop.colReleased', '해제')}
                  </th>
                  <th className="border-b border-r border-border px-2 py-1.5 font-semibold">
                    {t('kiosk.equipStop.reason', '정지사유')}
                  </th>
                  <th className="border-b border-border px-2 py-1.5 text-right font-semibold">
                    {t('kiosk.equipStop.colLoss', '유실시간')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center text-black/50 dark:text-white/50">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : history.map((row, idx) => (
                  <tr
                    key={row.stopId}
                    className={`border-t border-border ${idx % 2 === 1 ? 'bg-black/[0.03] dark:bg-white/[0.04]' : ''}`}
                  >
                    <td className="border-r border-border px-2 py-1.5 font-mono tabular-nums">
                      {row.startedAt?.slice(11) ?? '-'}
                    </td>
                    <td className="border-r border-border px-2 py-1.5 font-mono tabular-nums">
                      {row.releasedAt?.slice(11) ?? '-'}
                    </td>
                    <td className="border-r border-border px-2 py-1.5">
                      <StopReasonLabel code={row.stopReason} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatDuration(row.lossSeconds)}
                      {row.status === 'OPEN' && (
                        <span className="ml-1 font-bold text-red-600 dark:text-red-400">
                          ({t('kiosk.equipStop.stopping', '정지 중')})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

/** 사유 코드 라벨 — 공통코드 단일 출처 */
function StopReasonLabel({ code }: { code: string | null }) {
  const { t } = useTranslation();
  const label = useComCodeLabel('EQUIP_STOP_REASON', code ?? '');
  if (!code) {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">
        {t('kiosk.equipStop.undecided', '사유미정')}
      </span>
    );
  }
  return <span>{label}</span>;
}

function extractMessage(e: unknown, fallback: string): string {
  const res = (e as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = res?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message ?? fallback;
}
