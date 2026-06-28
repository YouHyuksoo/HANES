"use client";

/**
 * @file components/WorkHistoryPanel.tsx
 * @description 우측 패널 — 양품조건(라우팅 기준) + 최근 작업이력
 *
 * 초보자 가이드:
 * - 양품조건: 작업지시의 itemCode → by-item API로 routingCode+seq 조회 →
 *             GET /master/routing-groups/:code/processes/:seq/conditions
 * - 작업이력: GET /production/prod-results?orderNo=&limit=10
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, CheckCircle2, XCircle, Clock, FlaskConical } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import { useComCodeList } from '@/hooks/useComCode';

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
  matUid?: string;
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

export default function WorkHistoryPanel() {
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

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-border/50 shrink-0">
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
              <li key={item.resultNo ?? idx} className="px-3 py-2 hover:bg-surface/50 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-text-muted tabular-nums w-4 text-right shrink-0">
                    {idx + 1}
                  </span>
                  {item.matUid && (
                    <span className="text-xs font-mono text-text truncate flex-1">{item.matUid}</span>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" />{(item.goodQty ?? 0).toLocaleString()}
                    </span>
                    {item.defectQty > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400 font-medium">
                        <XCircle className="w-3 h-3" />{(item.defectQty ?? 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                {(item.startAt || item.workerName) && (
                  <div className="flex items-center gap-2 pl-6">
                    {item.workerName && (
                      <span className="text-xs text-text-muted">{item.workerName}</span>
                    )}
                    {item.startAt && (
                      <span className="flex items-center gap-0.5 text-xs text-text-muted">
                        <Clock className="w-2.5 h-2.5" />
                        {formatHistoryTime(item.startAt)}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
