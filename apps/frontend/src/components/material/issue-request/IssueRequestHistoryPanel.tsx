"use client";

/**
 * @file src/components/material/issue-request/IssueRequestHistoryPanel.tsx
 * @description 출고요청 화면 [출고요청 내역] 탭 - 선택한 작업지시의 요청건을 요청건별로 접기/펼치기
 *
 * 초보자 가이드:
 * 1. **요청건 헤더 클릭 = 인라인 접기/펼치기**. 별도 상세 모달을 띄우지 않는다(같은 내용이 두 번 보이던 중복 제거).
 * 2. **기본 펼침은 최신 1건**. 요청이 많아도 목록이 길어지지 않는다.
 * 3. **하단 합계**는 화면에 표시 중인 전체 요청건 기준이다(접힌 건 포함).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, FilePlus2, ListChecks, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { IssueRequestStatusBadge, type IssueRequestStatus } from '@/components/material';
import { formatDateTimeKst } from '@/utils/dateTimeKst';
import type { IssueRequest } from '@/hooks/material/useIssueRequestData';

interface IssueRequestHistoryPanelProps {
  requests: IssueRequest[];
  isLoading?: boolean;
  onCreateRequest: () => void;
}

const toNum = (v: number | null | undefined) => Number(v ?? 0);

export default function IssueRequestHistoryPanel({
  requests,
  isLoading,
  onCreateRequest,
}: IssueRequestHistoryPanelProps) {
  const { t } = useTranslation();
  const [expandedRequestNos, setExpandedRequestNos] = useState<Set<string>>(() => new Set());

  // 작업지시를 바꾸면 최신 1건만 펼친 상태로 초기화한다.
  useEffect(() => {
    const latest = requests[0]?.requestNo;
    setExpandedRequestNos(latest ? new Set([latest]) : new Set());
  }, [requests]);

  const totals = useMemo(() => {
    let itemCount = 0;
    let requestQty = 0;
    let issuedQty = 0;
    requests.forEach((req) => {
      const items = req.items ?? [];
      itemCount += items.length;
      items.forEach((item) => {
        requestQty += toNum(item.requestQty);
        issuedQty += toNum(item.issuedQty);
      });
    });
    return { itemCount, requestQty, issuedQty };
  }, [requests]);

  const toggleRequest = (requestNo: string) => {
    setExpandedRequestNos((prev) => {
      const next = new Set(prev);
      if (next.has(requestNo)) next.delete(requestNo);
      else next.add(requestNo);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-text-muted text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-text-muted text-sm gap-2">
        <ListChecks className="w-8 h-8 opacity-40" />
        <span>{t('material.request.noRequestForOrder')}</span>
        <Button size="sm" variant="secondary" onClick={onCreateRequest}>
          <FilePlus2 className="w-4 h-4 mr-1" /> {t('material.request.tabCreate')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
      {requests.map((req) => {
        const expanded = expandedRequestNos.has(req.requestNo);
        const items = req.items ?? [];
        return (
          <div key={req.requestNo} className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleRequest(req.requestNo)}
              aria-expanded={expanded}
              data-testid="mat-request-history-header"
              className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-background/50 hover:bg-card-hover text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                {expanded
                  ? <ChevronDown className="w-4 h-4 shrink-0 text-text-muted" />
                  : <ChevronRight className="w-4 h-4 shrink-0 text-text-muted" />}
                <span className="font-mono text-xs font-semibold text-text">{req.requestNo}</span>
                <IssueRequestStatusBadge status={req.status as IssueRequestStatus} />
                {req.requestDate && (
                  <span className="text-xs text-text-muted">{formatDateTimeKst(req.requestDate)}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted shrink-0">
                <span>{t('material.issueAccount')}: {req.issueType || t('material.request.notSelected')}</span>
                <span>{items.length}{t('material.request.items')}</span>
                <span className="text-text">
                  {t('material.request.requestQtyLabel')} {toNum(req.totalRequestQty ?? req.totalQty).toLocaleString()}
                </span>
                {req.requester && <span>{req.requester}</span>}
              </div>
            </button>
            {expanded && (
              <table className="w-full text-sm">
                <thead className="bg-background/30 text-text-muted">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium w-8">#</th>
                    <th className="text-left px-3 py-1.5 font-medium">{t('common.partCode')}</th>
                    <th className="text-left px-3 py-1.5 font-medium">{t('common.partName')}</th>
                    <th className="text-center px-3 py-1.5 font-medium w-16">{t('common.unit')}</th>
                    <th className="text-right px-3 py-1.5 font-medium w-24">{t('material.request.requestQtyLabel')}</th>
                    <th className="text-right px-3 py-1.5 font-medium w-24">{t('material.issue.issuedLabel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={`${req.requestNo}-${item.itemCode}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-1.5 text-text-muted">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{item.itemCode}</td>
                      <td className="px-3 py-1.5">{item.itemName}</td>
                      <td className="px-3 py-1.5 text-center text-text-muted">{item.unit}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{toNum(item.requestQty).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-text-muted">{toNum(item.issuedQty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      <div className="sticky bottom-0 border-t border-border bg-surface p-3 flex justify-end gap-5 text-sm font-semibold" role="status">
        <span>{t('common.total', '합계')}</span>
        <span>{t('material.col.itemCount', '품목수')} {totals.itemCount.toLocaleString()}</span>
        <span>{t('material.request.requestQtyLabel')} {totals.requestQty.toLocaleString()}</span>
        <span>{t('material.issue.issuedLabel')} {totals.issuedQty.toLocaleString()}</span>
      </div>
    </div>
  );
}
