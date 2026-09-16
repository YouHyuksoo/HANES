"use client";

/**
 * @file components/WorkHistoryPanel.tsx
 * @description 우측 패널 — 양품조건(라우팅 기준) + 최근 작업이력 + 당일 유실 이력
 *
 * 초보자 가이드:
 * - 양품조건: 작업지시의 itemCode → by-item API로 routingCode+seq 조회 →
 *             GET /master/routing-groups/:code/processes/:seq/conditions
 * - 작업이력: GET /production/prod-results?orderNo=&limit=10
 * - 유실 이력: 설비정지 훅(useEquipStop)이 가진 당일 이력을 page.tsx에서 내려받는다.
 *              합계는 서버 집계값을 그대로 쓴다(메모리 재집계 금지).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, CheckCircle2, XCircle, Clock, FlaskConical, Square } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import { useComCodeList, useComCodeLabel } from '@/hooks/useComCode';
import { formatDuration, type EquipStopEvent, type EquipStopSummary } from '../hooks/useEquipStop';

interface QualityCondition {
  conditionSeq: number;
  conditionCode: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  equipInterfaceYn: string;
}

interface HistoryItem {
  // 목록 API(GET /production/prod-results)는 PK를 resultNo로 반환한다(id 필드 없음)
  resultNo: string;
  // 생산실적의 제품 바코드는 PROD_RESULTS.PRD_UID로 반환된다.
  prdUid?: string;
  goodQty: number;
  defectQty: number;
  workerName?: string;
  startAt?: string;
  endAt?: string;
  createdAt?: string;
}

function formatHistoryTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 19).replace('T', ' ');
}

interface WorkHistoryPanelProps {
  /** 당일 설비정지 이력 (useEquipStop) */
  stopHistory?: EquipStopEvent[];
  /** 당일 유실시간 집계 (서버 산출) */
  stopSummary?: EquipStopSummary;
  /** 유실 이력 줄을 누르면 설비정지 팝업을 연다 */
  onOpenEquipStop?: () => void;
}

/** 유실 이력은 좁은 패널이라 최근 것만 보여준다. 전체는 설비정지 팝업에서 본다. */
const STOP_HISTORY_VISIBLE = 3;

export default function WorkHistoryPanel({
  stopHistory = [],
  stopSummary,
  onOpenEquipStop,
}: WorkHistoryPanelProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder } = useKioskStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [conditions, setConditions] = useState<QualityCondition[]>([]);
  const conditionCodes = useComCodeList('QUALITY_CONDITION');

  // 라우팅 양품조건 로드: itemCode → routing → processCode 매칭 → conditions
  useEffect(() => {
    if (!selectedJobOrder?.itemCode || !selectedJobOrder?.processCode) {
      setConditions([]);
      return;
    }
    const itemCode = selectedJobOrder.itemCode;
    const processCode = selectedJobOrder.processCode;

    api.get(`/master/routing-groups/by-item/${itemCode}`)
      .then(res => {
        const routing = res.data?.data;
        if (!routing) { setConditions([]); return; }
        const process = (routing.processes ?? []).find(
          (p: { processCode: string }) => p.processCode === processCode
        );
        if (!process) { setConditions([]); return; }
        return api.get(`/master/routing-groups/${routing.routingCode}/processes/${process.seq}/conditions`);
      })
      .then(res => {
        if (!res) return;
        setConditions(res.data?.data ?? []);
      })
      .catch(() => setConditions([]));
  }, [selectedJobOrder?.itemCode, selectedJobOrder?.processCode]);

  const fetchHistory = () => {
    if (!selectedEquip?.equipCode || !selectedJobOrder?.orderNo) {
      setHistory([]);
      return;
    }
    const params: Record<string, string> = { limit: '10' };
    params.orderNo = selectedJobOrder.orderNo;
    api.get('/production/prod-results', { params })
      .then(res => setHistory(res.data?.data ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEquip?.equipCode, selectedJobOrder?.orderNo]);

  const totalGood = history.reduce((s, h) => s + h.goodQty, 0);
  const totalDefect = history.reduce((s, h) => s + h.defectQty, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 양품조건 — 라우팅 공정 기준 */}
      <div className="border-b border-border/50 shrink-0 max-h-48 flex flex-col">
        <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-3 py-2 flex items-center gap-1.5 border-b border-border">
          <FlaskConical className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-semibold text-text">{t('kiosk.history.qualityCriteria')}</span>
          {conditions.length > 0 && (
            <span className="ml-auto text-xs text-text-muted">{conditions.length}{t('kiosk.material.unit')}</span>
          )}
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {conditions.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-xs text-text-muted">{t('kiosk.history.criteriaPlaceholder')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {conditions.map(cond => {
                const codeName = conditionCodes.find(c => c.detailCode === cond.conditionCode)?.codeName
                  ?? cond.conditionCode ?? '-';
                const hasRange = cond.minValue != null || cond.maxValue != null;
                return (
                  <li key={cond.conditionSeq} className="px-3 py-1.5">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text leading-snug">{codeName}</p>
                        {hasRange && (
                          <p className="text-xs text-text-muted leading-snug mt-0.5 tabular-nums">
                            {cond.minValue != null ? cond.minValue : '∞'} ~{' '}
                            {cond.maxValue != null ? cond.maxValue : '∞'}
                            {cond.unit ? ` ${cond.unit}` : ''}
                          </p>
                        )}
                      </div>
                      {cond.equipInterfaceYn === 'Y' && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1 rounded shrink-0">{t('kiosk.history.equipInterface', '설비')}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 요약 통계 — 양품/불량/유실 */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border/50 shrink-0">
        <div className="bg-card border border-border rounded p-2 text-center">
          <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
            {totalGood.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">{t('kiosk.history.goodTotal')}</p>
        </div>
        <div className="bg-card border border-border rounded p-2 text-center">
          <p className="text-lg font-bold text-red-500 dark:text-red-400 tabular-nums">
            {totalDefect.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">{t('kiosk.history.defectTotal')}</p>
        </div>
        {/* 유실합계 — 수량이 아니라 시간이라 단위가 다르다. 당일 이 설비 기준. */}
        <div className="bg-card border border-border rounded p-2 text-center">
          <p
            data-testid="kiosk-history-loss-total"
            className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums"
          >
            {formatDuration(stopSummary?.totalLossSeconds ?? 0)}
          </p>
          <p className="text-xs text-text-muted">{t('kiosk.history.lossTotal', '유실 합계')}</p>
        </div>
      </div>

      {/* 작업이력 목록 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-border flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-text">{t('kiosk.history.recentHistory')}</span>
        </div>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <History className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">{t('kiosk.history.noHistory')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {history.map((item, idx) => (
              <li
                key={item.resultNo ?? idx}
                className="px-2.5 py-1.5 hover:bg-surface/50 transition-colors"
                title={[item.workerName, item.startAt && formatHistoryTime(item.startAt)].filter(Boolean).join(' · ')}
              >
                <div className="flex items-center gap-1.5 min-w-0 whitespace-nowrap">
                  <span className="text-[11px] text-text-muted tabular-nums w-3.5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-[11px] font-mono text-text truncate flex-1 min-w-0">
                    {item.prdUid || item.resultNo}
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] text-green-600 dark:text-green-400 font-medium shrink-0">
                      <CheckCircle2 className="w-3 h-3" />{(item.goodQty ?? 0).toLocaleString()}
                  </span>
                  {item.defectQty > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-red-600 dark:text-red-400 font-medium shrink-0">
                        <XCircle className="w-3 h-3" />{(item.defectQty ?? 0).toLocaleString()}
                    </span>
                  )}
                  {item.startAt && (
                    <span className="flex items-center gap-0.5 text-[10px] text-text-muted tabular-nums shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {formatHistoryTime(item.startAt).slice(11, 16)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 유실 이력 — 작업이력 아래 고정 높이. 최근 3건만 보여주고 전체는 설비정지 팝업에서 본다. */}
      <div className="shrink-0 border-t border-border">
        <div className="flex items-center gap-1.5 border-b border-border bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
          <Square className="h-3 w-3 text-amber-500" />
          <span className="text-xs font-semibold text-text">{t('kiosk.history.lossHistory', '유실 이력')}</span>
          {stopHistory.length > STOP_HISTORY_VISIBLE && (
            <button
              type="button"
              onClick={onOpenEquipStop}
              className="ml-auto text-[10px] text-text-muted underline-offset-2 hover:text-primary hover:underline"
            >
              {t('kiosk.history.lossMore', '전체 {{count}}건', { count: stopHistory.length })}
            </button>
          )}
        </div>
        {stopHistory.length === 0 ? (
          <p className="px-3 py-2 text-center text-[11px] text-text-muted">
            {t('kiosk.history.noLoss', '당일 정지 없음')}
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {stopHistory.slice(0, STOP_HISTORY_VISIBLE).map(stop => (
              <li
                key={stop.stopId}
                onClick={onOpenEquipStop}
                /* pr-11: 우하단 개선요청 FAB(bottom-5 right-3, 36px → 우측 48px 점유)이 마지막 줄의 유실시간을 가린다.
                   세로로 여백을 키우는 대신 오른쪽만 비워 겹침을 피한다. */
                className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap py-1.5 pl-2.5 pr-14 transition-colors hover:bg-surface/50"
              >
                <span className="text-[10px] tabular-nums text-text-muted shrink-0">
                  {stop.startedAt?.slice(11, 16) ?? '-'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-text">
                  <StopReasonText code={stop.stopReason} />
                </span>
                {stop.status === 'OPEN' && (
                  <span className="shrink-0 text-[10px] font-bold text-red-600 dark:text-red-400">
                    {t('kiosk.equipStop.stopping', '정지 중')}
                  </span>
                )}
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  {formatDuration(stop.lossSeconds)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** 정지사유 라벨 — 공통코드 단일 출처, 미정이면 빨간 '사유미정' */
function StopReasonText({ code }: { code: string | null }) {
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
