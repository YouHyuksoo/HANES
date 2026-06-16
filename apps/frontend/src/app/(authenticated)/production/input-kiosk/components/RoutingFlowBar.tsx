"use client";

/**
 * @file components/RoutingFlowBar.tsx
 * @description 중앙 상단 — 선택된 작업지시 제품의 라우팅(공정 순서) 가로 스텝퍼
 *
 * 초보자 가이드:
 * - API: GET /master/routing-groups/by-item/:itemCode → { routingCode, routingName, processes:[{seq, processCode, processName}] }
 * - 작업지시(itemCode) 기준으로 제품에 매핑된 라우팅 그룹의 공정순서를 표시한다.
 * - 현재 공정(선택 설비 공정 우선, 없으면 작업지시 공정)은 강조한다.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Workflow, ChevronRight } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface RoutingProcessRow {
  seq: number;
  processCode: string;
  processName: string;
}

interface RoutingInfo {
  routingCode: string;
  routingName: string;
  processes: RoutingProcessRow[];
}

export default function RoutingFlowBar() {
  const { t } = useTranslation();
  const { selectedJobOrder, selectedEquip } = useKioskStore();
  const [routing, setRouting] = useState<RoutingInfo | null>(null);

  useEffect(() => {
    if (!selectedJobOrder?.itemCode) { setRouting(null); return; }
    api.get(`/master/routing-groups/by-item/${selectedJobOrder.itemCode}`)
      .then(res => setRouting(res.data?.data ?? null))
      .catch(() => setRouting(null));
  }, [selectedJobOrder?.itemCode]);

  // 작업지시 미선택 시에는 라우팅 바를 숨긴다(작업지도서가 안내 문구를 담당).
  if (!selectedJobOrder) return null;

  const currentProcess = selectedEquip?.processCode ?? selectedJobOrder?.processCode;
  const processes = routing?.processes ?? [];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-slate-100 dark:bg-slate-800 shrink-0 overflow-x-auto">
      <Workflow className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-xs font-semibold text-text shrink-0">{t('kiosk.routing.title')}</span>
      {routing?.routingName && (
        <span className="text-[11px] text-text-muted shrink-0 truncate max-w-[140px]" title={routing.routingName}>
          {routing.routingName}
        </span>
      )}
      {processes.length === 0 ? (
        <span className="text-[11px] text-text-muted italic shrink-0">{t('kiosk.routing.none')}</span>
      ) : (
        <div className="flex items-center gap-1 min-w-0">
          {processes.map((p, i) => {
            const isCurrent = Boolean(currentProcess) && p.processCode === currentProcess;
            return (
              <div key={`${p.processCode}-${p.seq}`} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />}
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
                    isCurrent
                      ? 'border-primary text-primary font-bold'
                      : 'border-border text-text-muted',
                  ].join(' ')}
                  title={`${p.processCode} (seq ${p.seq})`}
                >
                  <span className="tabular-nums opacity-60">{p.seq}</span>
                  {p.processName || p.processCode}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
