"use client";

/**
 * @file src/components/material/ManualIssueRequestPanel.tsx
 * @description 작업지시 없이 품목을 직접 검색해 출고요청을 등록하는 우측 슬라이드 패널
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Plus, Search, X } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import PartSearchModal, { type PartItem } from '@/components/shared/PartSearchModal';
import { api } from '@/services/api';
import { useInvalidateQueries } from '@/hooks/useApi';
import type { RequestItem } from '@/hooks/material/useIssueRequestData';

interface ManualIssueRequestPanelProps {
  onClose: () => void;
  onSubmitted?: () => void | Promise<unknown>;
  animate?: boolean;
}

type IssueRequestPartItem = PartItem & {
  currentStock?: number | null;
  minPackQty?: number | null;
};

export default function ManualIssueRequestPanel({
  onClose,
  onSubmitted,
  animate = true,
}: ManualIssueRequestPanelProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();
  const [remark, setRemark] = useState('생산투입');
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const reasonOptions = [
    { value: '생산투입', label: t('material.request.reasonProduction') },
    { value: '시작품', label: t('material.request.reasonPrototype') },
    { value: '샘플', label: t('material.request.reasonSample') },
    { value: '기타', label: t('material.request.reasonOther') },
  ];

  const addSelectedPart = useCallback((part: PartItem) => {
    const selectedPart = part as IssueRequestPartItem;
    setRequestItems((prev) => {
      if (prev.some((r) => r.itemCode === selectedPart.itemCode)) return prev;
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
    setRequestItems((prev) => prev.filter((r) => r.itemCode !== itemCode));
  };

  const updateQty = (itemCode: string, qty: number) => {
    setRequestItems((prev) =>
      prev.map((r) => (r.itemCode === itemCode ? { ...r, requestQty: qty } : r)),
    );
  };

  const handleClose = () => {
    setRemark('생산투입');
    setPartSearchOpen(false);
    setRequestItems([]);
    setErrorMessage('');
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const body = {
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
      };
      await api.post('/material/issue-requests', body);
      invalidate(['issue-request-data']);
      invalidate(['issue-requests']);
      await onSubmitted?.();
      handleClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || t('common.errorOccurred', { defaultValue: '요청 처리 중 오류가 발생했습니다.' });
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    requestItems.length > 0 && requestItems.every((r) => r.requestQty > 0) && !isSubmitting;

  return (
    <>
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? 'animate-slide-in-right' : ''}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{t('material.request.manualRequest')}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            {t('material.request.registerRequest')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
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
              <Search className="w-4 h-4 mr-1" />
              {t('common.search')}
            </Button>
          </div>
        </div>

        {requestItems.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
              {t('material.request.requestItemCount', { count: requestItems.length })}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-background/50">
                <tr>
                  <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t('common.partName')}</th>
                  <th className="text-right px-3 py-1.5 text-text-muted font-medium w-20">{t('material.request.currentStock')}</th>
                  <th className="text-center px-3 py-1.5 text-text-muted font-medium w-28">{t('material.request.requestQtyLabel')}</th>
                  <th className="text-center px-3 py-1.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {requestItems.map((item) => {
                  const overStock = item.requestQty > item.currentStock;
                  return (
                    <tr key={item.itemCode} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <span>{item.itemName}</span>
                        <span className="ml-2 text-xs text-text-muted">({item.unit})</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">{item.currentStock.toLocaleString()}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={item.requestQty || ''}
                            onChange={(e) => updateQty(item.itemCode, Number(e.target.value))}
                            className={`w-full px-2 py-1 text-sm border rounded text-right bg-surface text-text ${overStock ? 'border-red-400' : 'border-border'}`}
                            placeholder="0"
                          />
                          {overStock && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.itemCode)}
                          className="p-1 text-red-400 hover:text-red-600 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
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
