"use client";

/**
 * @file components/WorkHistoryPanel.tsx
 * @description 우측 패널 — 양품조건(자주검사 기준) + 최근 작업이력
 *
 * 초보자 가이드:
 * - 양품조건: GET /production/self-inspect/items?processCode= (검사기준 표시)
 * - 작업이력: GET /production/prod-results?equipCode=&limit=10
 * - 10초마다 자동 갱신 (현장 모니터링용)
 */
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { History, CheckCircle2, XCircle, Clock, FlaskConical } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface InspectItem {
  id: string;
  itemName: string;
  standard: string;
  inspectMethod: 'DIRECT' | 'DELEGATE';
  timing: string;
  isDestructive: boolean;
}

interface HistoryItem {
  id: string;
  matUid?: string;
  goodQty: number;
  defectQty: number;
  workerName?: string;
  startAt?: string;
  endAt?: string;
  createdAt?: string;
}

const REFRESH_INTERVAL = 10_000;

export default function WorkHistoryPanel() {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder } = useKioskStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inspectItems, setInspectItems] = useState<InspectItem[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 공정별 검사항목(양품조건) 로드
  useEffect(() => {
    if (!selectedJobOrder?.processCode) { setInspectItems([]); return; }
    api.get('/production/self-inspect/items', {
      params: { processCode: selectedJobOrder.processCode },
    })
      .then(res => setInspectItems(res.data?.data ?? []))
      .catch(() => setInspectItems([]));
  }, [selectedJobOrder?.processCode]);

  const fetchHistory = () => {
    if (!selectedEquip?.equipCode) { setHistory([]); return; }
    const params: Record<string, string> = { limit: '10' };
    if (selectedJobOrder?.orderNo) params.orderNo = selectedJobOrder.orderNo;
    else params.equipCode = selectedEquip.equipCode;
    api.get('/production/prod-results', { params })
      .then(res => setHistory(res.data?.data ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchHistory();
    timerRef.current = setInterval(fetchHistory, REFRESH_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEquip?.equipCode, selectedJobOrder?.orderNo]);

  const totalGood = history.reduce((s, h) => s + h.goodQty, 0);
  const totalDefect = history.reduce((s, h) => s + h.defectQty, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 양품조건 — 자주검사 항목 기준 */}
      <div className="border-b border-border/50 shrink-0 max-h-48 flex flex-col">
        <div className="sticky top-0 bg-card px-3 py-2 flex items-center gap-1.5 border-b border-border/30">
          <FlaskConical className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-semibold text-text">{t('kiosk.history.qualityCriteria')}</span>
          {inspectItems.length > 0 && (
            <span className="ml-auto text-xs text-text-muted">{inspectItems.length}{t('kiosk.material.unit')}</span>
          )}
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {inspectItems.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-xs text-text-muted">{t('kiosk.history.criteriaPlaceholder')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {inspectItems.map(item => (
                <li key={item.id} className="px-3 py-1.5">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text leading-snug">{item.itemName}</p>
                      <p className="text-xs text-text-muted leading-snug mt-0.5">{item.standard}</p>
                    </div>
                    {item.inspectMethod === 'DELEGATE' && (
                      <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1 rounded shrink-0">의뢰</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-border/50 shrink-0">
        <div className="bg-green-50 dark:bg-green-900/20 rounded p-2 text-center">
          <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
            {totalGood.toLocaleString()}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">{t('kiosk.history.goodTotal')}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 text-center">
          <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
            {totalDefect.toLocaleString()}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">{t('kiosk.history.defectTotal')}</p>
        </div>
      </div>

      {/* 작업이력 목록 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-card px-3 py-1.5 border-b border-border/30 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-text">{t('kiosk.history.recentHistory')}</span>
          <span className="ml-auto text-xs text-text-muted">{t('kiosk.history.autoRefresh')}</span>
        </div>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <History className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">{t('kiosk.history.noHistory')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {history.map((item, idx) => (
              <li key={item.id} className="px-3 py-2 hover:bg-surface/50 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-text-muted tabular-nums w-4 text-right shrink-0">
                    {idx + 1}
                  </span>
                  {item.matUid && (
                    <span className="text-xs font-mono text-text truncate flex-1">{item.matUid}</span>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" />{item.goodQty}
                    </span>
                    {item.defectQty > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400 font-medium">
                        <XCircle className="w-3 h-3" />{item.defectQty}
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
                        {item.startAt}
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
