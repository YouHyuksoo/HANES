"use client";

/**
 * @file src/components/material/IssueRequestDetailModal.tsx
 * @description 출고요청 상세 조회 모달
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/ui';
import { IssueRequestStatusBadge } from '@/components/material';
import type { IssueRequest, RequestItem } from '@/hooks/material/useIssueRequestData';
import type { IssueRequestStatus } from '@/components/material';

interface IssueRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: IssueRequest | null;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | string | null | undefined): string {
  return toNumber(value).toLocaleString();
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-text-muted">{label}</div>
      <div className="mt-1 min-h-5 truncate text-sm font-semibold text-text">{value || '-'}</div>
    </div>
  );
}

function remainQty(item: RequestItem): number {
  return Math.max(toNumber(item.requestQty) - toNumber(item.issuedQty), 0);
}

export default function IssueRequestDetailModal({ isOpen, onClose, request }: IssueRequestDetailModalProps) {
  const { t } = useTranslation();
  const items = request?.items ?? [];
  const totalRequestQty = useMemo(
    () => toNumber(request?.totalQty ?? request?.totalRequestQty) || items.reduce((sum, item) => sum + toNumber(item.requestQty), 0),
    [items, request?.totalQty, request?.totalRequestQty],
  );
  const totalIssuedQty = useMemo(
    () => toNumber(request?.totalIssuedQty) || items.reduce((sum, item) => sum + toNumber(item.issuedQty), 0),
    [items, request?.totalIssuedQty],
  );
  const totalRemainQty = Math.max(totalRequestQty - totalIssuedQty, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={request ? `출고요청 상세 - ${request.requestNo}` : '출고요청 상세'}
      size="2xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {!request ? (
        <div className="py-10 text-center text-sm text-text-muted">{t('common.noData')}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded border border-border bg-background/60 p-3 md:grid-cols-4">
            <DetailField label={t('material.col.requestNo')} value={request.requestNo} />
            <DetailField label={t('material.col.workOrder')} value={request.workOrderNo ?? request.orderNo ?? '-'} />
            <DetailField label={t('common.status')} value={<IssueRequestStatusBadge status={request.status as IssueRequestStatus} />} />
            <DetailField label={t('material.issueAccount')} value={request.issueType ?? '-'} />
            <DetailField label={t('material.col.requestDate')} value={formatDateTime(request.requestDate)} />
            <DetailField label={t('material.col.requester')} value={request.requester ?? '-'} />
            <DetailField label="승인자" value={request.approver ?? '-'} />
            <DetailField label="승인일시" value={formatDateTime(request.approvedAt)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded border border-border bg-background/60 p-3">
              <div className="text-[11px] text-text-muted">요청수량</div>
              <div className="mt-1 text-lg font-bold text-text">{formatNumber(totalRequestQty)}</div>
            </div>
            <div className="rounded border border-border bg-background/60 p-3">
              <div className="text-[11px] text-text-muted">출고수량</div>
              <div className="mt-1 text-lg font-bold text-primary">{formatNumber(totalIssuedQty)}</div>
            </div>
            <div className="rounded border border-border bg-background/60 p-3">
              <div className="text-[11px] text-text-muted">잔여수량</div>
              <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-300">{formatNumber(totalRemainQty)}</div>
            </div>
          </div>

          {(request.remark || request.rejectReason) && (
            <div className="grid gap-2 rounded border border-border bg-background/60 p-3 text-sm">
              {request.remark && (
                <div>
                  <span className="font-medium text-text-muted">{t('common.remark')}: </span>
                  <span className="text-text">{request.remark}</span>
                </div>
              )}
              {request.rejectReason && (
                <div>
                  <span className="font-medium text-red-500">{t('common.reject')}: </span>
                  <span className="text-text">{request.rejectReason}</span>
                </div>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded border border-border">
            <div className="flex items-center justify-between border-b border-border bg-background/70 px-3 py-2">
              <div className="text-sm font-semibold text-text">요청 품목 상세</div>
              <div className="text-xs text-text-muted">{items.length}{t('material.request.items')}</div>
            </div>
            <div className="max-h-[42vh] overflow-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-text-muted">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left">품목코드</th>
                    <th className="px-3 py-2 text-left">품목명</th>
                    <th className="px-3 py-2 text-right">요청</th>
                    <th className="px-3 py-2 text-right">출고</th>
                    <th className="px-3 py-2 text-right">잔여</th>
                    <th className="px-3 py-2 text-right">현재고</th>
                    <th className="px-3 py-2 text-right">BOM소요</th>
                    <th className="px-3 py-2 text-right">기불출</th>
                    <th className="px-3 py-2 text-right">현장재고</th>
                    <th className="px-3 py-2 text-center">{t('common.unit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-text-muted">
                        {t('common.noData')}
                      </td>
                    </tr>
                  ) : items.map((item) => (
                    <tr key={`${item.requestId ?? request.requestNo}-${item.seq ?? item.itemCode}`} className="border-b border-border/70 last:border-0">
                      <td className="px-3 py-2 font-medium text-primary">{item.itemCode}</td>
                      <td className="px-3 py-2 text-text">{item.itemName ?? '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.requestQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.issuedQty)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(remainQty(item))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.currentStock)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.bomReqQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.prevIssueQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.floorStockQty)}</td>
                      <td className="px-3 py-2 text-center">{item.unit ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
