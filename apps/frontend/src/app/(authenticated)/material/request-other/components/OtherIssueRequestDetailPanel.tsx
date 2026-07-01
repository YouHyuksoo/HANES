"use client";

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { AlertTriangle, ClipboardList, Loader2, Plus, Search, X } from 'lucide-react';
import { IssueRequestStatusBadge } from '@/components/material';
import { Button, ComCodeBadge, Input, Select } from '@/components/ui';
import PartSearchModal, { type PartItem } from '@/components/shared/PartSearchModal';
import { api } from '@/services/api';
import { useInvalidateQueries } from '@/hooks/useApi';
import type { IssueRequest, RequestItem } from '@/hooks/material/useIssueRequestData';
import type { IssueRequestStatus } from '@/components/material';

interface OtherIssueRequestDetailPanelProps {
  request: IssueRequest | null;
  mode: 'detail' | 'create';
  onCancelCreate: () => void;
  onSubmitted?: () => void | Promise<unknown>;
}

type IssueRequestPartItem = PartItem & {
  currentStock?: number | null;
  minPackQty?: number | null;
};

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

function remainQty(item: RequestItem): number {
  return Math.max(toNumber(item.requestQty) - toNumber(item.issuedQty), 0);
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-border bg-background/60 px-3 py-2">
      <div className="text-[11px] font-medium text-text-muted">{label}</div>
      <div className="mt-1 min-h-5 truncate text-sm font-semibold text-text">{value || '-'}</div>
    </div>
  );
}

export default function OtherIssueRequestDetailPanel({
  request,
  mode,
  onCancelCreate,
  onSubmitted,
}: OtherIssueRequestDetailPanelProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();
  const [remark, setRemark] = useState('생산투입');
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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

  const reasonOptions = [
    { value: '생산투입', label: t('material.request.reasonProduction') },
    { value: '시작품', label: t('material.request.reasonPrototype') },
    { value: '샘플', label: t('material.request.reasonSample') },
    { value: '기타', label: t('material.request.reasonOther') },
  ];

  const resetCreateForm = useCallback(() => {
    setRemark('생산투입');
    setPartSearchOpen(false);
    setRequestItems([]);
    setErrorMessage('');
    setIsSubmitting(false);
  }, []);

  const handleCancelCreate = () => {
    resetCreateForm();
    onCancelCreate();
  };

  const addSelectedPart = useCallback((part: PartItem) => {
    const selectedPart = part as IssueRequestPartItem;
    setRequestItems((prev) => {
      if (prev.some((row) => row.itemCode === selectedPart.itemCode)) return prev;
      return [
        ...prev,
        {
          itemCode: selectedPart.itemCode,
          itemName: selectedPart.itemName,
          unit: selectedPart.unit ?? 'EA',
          currentStock: Number(selectedPart.currentStock ?? 0),
          requestQty: 0,
          bomReqQty: undefined,
          prevIssueQty: undefined,
          floorStockQty: undefined,
          minPackQty: Number(selectedPart.minPackQty ?? 0),
        },
      ];
    });
  }, []);

  const removeItem = (itemCode: string) => {
    setRequestItems((prev) => prev.filter((row) => row.itemCode !== itemCode));
  };

  const updateQty = (itemCode: string, qty: number) => {
    setRequestItems((prev) =>
      prev.map((row) => (row.itemCode === itemCode ? { ...row, requestQty: qty } : row)),
    );
  };

  const canSubmit =
    requestItems.length > 0 && requestItems.every((row) => toNumber(row.requestQty) > 0) && !isSubmitting;

  const handleSubmit = async () => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await api.post('/material/issue-requests', {
        orderNo: undefined,
        issueType: 'MANUAL',
        items: requestItems.map((item) => ({
          itemCode: item.itemCode,
          requestQty: item.requestQty,
          unit: item.unit,
          bomReqQty: item.bomReqQty,
          prevIssueQty: item.prevIssueQty,
          floorStockQty: item.floorStockQty,
        })),
        remark: remark || undefined,
      });
      invalidate(['issue-request-data']);
      invalidate(['issue-requests']);
      await onSubmitted?.();
      resetCreateForm();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || t('common.errorOccurred', { defaultValue: '요청 처리 중 오류가 발생했습니다.' });
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <aside className="w-[520px] flex-shrink-0 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs">
      <div className="flex-shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-text">
              <ClipboardList className="h-4 w-4 text-primary" />
              {mode === 'create'
                ? t('material.requestOther.newRequest', '기타출고요청')
                : request ? `${t('material.requestOther.title', '기타출고요청')} ${request.requestNo}` : t('common.detail', '상세')}
            </h2>
            <p className="mt-1 truncate text-xs text-text-muted">
              {mode === 'create'
                ? t('material.requestOther.description', '작업지시 없이 필요한 자재 출고요청을 등록하고 조회합니다.')
                : request ? t('material.requestOther.description', '작업지시 없이 필요한 자재 출고요청을 등록하고 조회합니다.') : t('common.noData')}
            </p>
          </div>
          {mode === 'create' && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleCancelCreate}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                {t('material.request.registerRequest')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {mode === 'create' ? (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Select
            label={t('material.request.reasonLabel')}
            options={reasonOptions}
            value={remark}
            onChange={setRemark}
            fullWidth
          />

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('material.request.searchLabel')}
            </label>
            <div className="flex gap-2">
              <Input
                value={requestItems.length > 0
                  ? t('material.request.requestItemCount', { count: requestItems.length })
                  : ''}
                readOnly
                placeholder={t('material.request.searchPartPlaceholder')}
                fullWidth
              />
              <Button variant="secondary" onClick={() => setPartSearchOpen(true)} className="flex-shrink-0">
                <Search className="h-4 w-4 mr-1" />
                {t('common.search')}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded border border-border">
            <div className="border-b border-border bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
              {t('material.request.requestItemCount', { count: requestItems.length })}
            </div>
            <div className="max-h-[56vh] overflow-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-text-muted">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left">{t('common.partName')}</th>
                    <th className="px-3 py-2 text-right">{t('material.request.currentStock')}</th>
                    <th className="px-3 py-2 text-center">{t('material.request.requestQtyLabel')}</th>
                    <th className="px-3 py-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {requestItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-text-muted">
                        {t('common.noData')}
                      </td>
                    </tr>
                  ) : requestItems.map((item) => {
                    const overStock = toNumber(item.requestQty) > toNumber(item.currentStock);
                    return (
                      <tr key={item.itemCode} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium text-text">{item.itemName}</div>
                          <div className="mt-0.5 text-xs text-text-muted">{item.itemCode} · {item.unit}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.currentStock)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={item.requestQty || ''}
                              onChange={(event) => updateQty(item.itemCode, Number(event.target.value))}
                              className={`w-full rounded border bg-surface px-2 py-1 text-right text-sm text-text ${overStock ? 'border-red-400' : 'border-border'}`}
                              placeholder="0"
                            />
                            {overStock && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.itemCode)}
                            className="rounded p-1 text-red-400 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !request ? (
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-text-muted">
          {t('common.selectItem', { defaultValue: '목록에서 항목을 선택하세요.' })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <DetailField label={t('material.col.requestNo')} value={request.requestNo} />
            <DetailField label={t('common.status')} value={<IssueRequestStatusBadge status={request.status as IssueRequestStatus} />} />
            <DetailField label={t('material.issueAccount')} value={request.issueType ? <ComCodeBadge groupCode="ISSUE_TYPE" code={request.issueType} /> : '-'} />
            <DetailField label={t('material.col.workOrder')} value={request.workOrderNo ?? request.orderNo ?? t('material.request.manualRequest')} />
            <DetailField label={t('material.col.requestDate')} value={formatDateTime(request.requestDate)} />
            <DetailField label={t('material.col.requester')} value={request.requester ?? '-'} />
            <DetailField label="승인자" value={request.approver ?? '-'} />
            <DetailField label="승인일시" value={formatDateTime(request.approvedAt)} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-border bg-primary/5 p-3">
              <div className="text-[11px] text-text-muted">요청수량</div>
              <div className="mt-1 text-base font-bold text-text">{formatNumber(totalRequestQty)}</div>
            </div>
            <div className="rounded border border-border bg-primary/5 p-3">
              <div className="text-[11px] text-text-muted">출고수량</div>
              <div className="mt-1 text-base font-bold text-primary">{formatNumber(totalIssuedQty)}</div>
            </div>
            <div className="rounded border border-border bg-amber-50 p-3 dark:bg-amber-500/10">
              <div className="text-[11px] text-text-muted">잔여수량</div>
              <div className="mt-1 text-base font-bold text-amber-600 dark:text-amber-300">{formatNumber(totalRemainQty)}</div>
            </div>
          </div>

          {(request.remark || request.rejectReason) && (
            <div className="space-y-2 rounded border border-border bg-background/60 p-3 text-sm">
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
            <div className="max-h-[48vh] overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-text-muted">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left">품목</th>
                    <th className="px-3 py-2 text-right">요청</th>
                    <th className="px-3 py-2 text-right">출고</th>
                    <th className="px-3 py-2 text-right">잔여</th>
                    <th className="px-3 py-2 text-right">현재고</th>
                    <th className="px-3 py-2 text-center">{t('common.unit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-text-muted">
                        {t('common.noData')}
                      </td>
                    </tr>
                  ) : items.map((item) => (
                    <tr key={`${item.requestId ?? request.requestNo}-${item.seq ?? item.itemCode}`} className="border-b border-border/70 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-primary">{item.itemCode}</div>
                        <div className="mt-0.5 truncate text-xs text-text-muted">{item.itemName ?? '-'}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.requestQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.issuedQty)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(remainQty(item))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.currentStock)}</td>
                      <td className="px-3 py-2 text-center">{item.unit ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </aside>
      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        onSelect={addSelectedPart}
        itemType="RAW_MATERIAL"
        modalSize="2xl"
      />
    </>
  );
}
