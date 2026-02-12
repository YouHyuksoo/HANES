"use client";

/**
 * @file src/pages/material/issue-request/components/RequestModal.tsx
 * @description 출고요청 모달 - 복수 품목 동시 요청 (장바구니 패턴)
 *
 * 초보자 가이드:
 * 1. **품목 검색**: 검색어로 품목을 찾아 현재고 확인
 * 2. **요청 목록**: [+]로 추가, [x]로 삭제, 수량 입력
 * 3. **현재고 초과 경고**: 요청수량이 현재고를 넘으면 경고 표시
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, X, AlertTriangle } from 'lucide-react';
import { Modal, Button, Input, Select } from '@/components/ui';
import type { StockItem, RequestItem } from '@/hooks/material/useIssueRequestData';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchStockItems: (query: string) => StockItem[];
  workOrderOptions: { value: string; label: string }[];
}

export default function RequestModal({ isOpen, onClose, searchStockItems, workOrderOptions }: RequestModalProps) {
  const { t } = useTranslation();
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [reason, setReason] = useState('생산투입');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockItem[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);

  const reasonOptions = [
    { value: '생산투입', label: t('material.request.reasonProduction') },
    { value: '시작품', label: t('material.request.reasonPrototype') },
    { value: '샘플', label: t('material.request.reasonSample') },
    { value: '기타', label: t('material.request.reasonOther') },
  ];

  const handleSearch = useCallback(() => {
    setSearchResults(searchStockItems(searchQuery));
  }, [searchQuery, searchStockItems]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const addItem = (item: StockItem) => {
    if (requestItems.some((r) => r.partCode === item.partCode)) return;
    setRequestItems((prev) => [
      ...prev,
      { partCode: item.partCode, partName: item.partName, unit: item.unit, currentStock: item.currentStock, requestQty: 0 },
    ]);
  };

  const removeItem = (partCode: string) => {
    setRequestItems((prev) => prev.filter((r) => r.partCode !== partCode));
  };

  const updateQty = (partCode: string, qty: number) => {
    setRequestItems((prev) =>
      prev.map((r) => r.partCode === partCode ? { ...r, requestQty: qty } : r)
    );
  };

  const handleSubmit = () => {
    const totalQty = requestItems.reduce((sum, r) => sum + r.requestQty, 0);
    console.log('출고요청 등록:', { workOrderNo, reason, items: requestItems, totalQty });
    handleClose();
  };

  const handleClose = () => {
    setWorkOrderNo('');
    setReason('생산투입');
    setSearchQuery('');
    setSearchResults([]);
    setRequestItems([]);
    onClose();
  };

  const canSubmit = workOrderNo && requestItems.length > 0 && requestItems.every((r) => r.requestQty > 0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('material.request.modalTitle')} size="lg">
      <div className="space-y-4">
        {/* 기본 정보 */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('material.col.workOrder')}
            options={workOrderOptions.filter((o) => o.value)}
            value={workOrderNo}
            onChange={setWorkOrderNo}
            fullWidth
          />
          <Select
            label={t('material.request.reasonLabel')}
            options={reasonOptions}
            value={reason}
            onChange={setReason}
            fullWidth
          />
        </div>

        {/* 품목 검색 */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t('material.request.searchLabel')}</label>
          <div className="flex gap-2">
            <Input
              placeholder={t('material.request.searchPartPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
            <Button variant="secondary" onClick={handleSearch}>{t('common.search')}</Button>
          </div>
        </div>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-background px-3 py-2 text-xs font-medium text-text-muted">
              {t('material.request.searchResultCount', { count: searchResults.length })}
            </div>
            <div className="max-h-[160px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/50">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t('common.partCode')}</th>
                    <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t('common.partName')}</th>
                    <th className="text-right px-3 py-1.5 text-text-muted font-medium">{t('material.request.currentStock')}</th>
                    <th className="text-center px-3 py-1.5 text-text-muted font-medium">{t('common.unit')}</th>
                    <th className="text-center px-3 py-1.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((item) => {
                    const alreadyAdded = requestItems.some((r) => r.partCode === item.partCode);
                    return (
                      <tr key={item.partCode} className="border-t border-border hover:bg-background/30">
                        <td className="px-3 py-1.5 font-mono text-xs">{item.partCode}</td>
                        <td className="px-3 py-1.5">{item.partName}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{item.currentStock.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-center text-text-muted">{item.unit}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={() => addItem(item)}
                            disabled={alreadyAdded}
                            className={`p-1 rounded ${alreadyAdded ? 'text-text-muted opacity-50' : 'text-primary hover:bg-primary/10'}`}
                            title={alreadyAdded ? t('material.request.alreadyAdded') : t('material.request.addToRequest')}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 요청 품목 목록 */}
        {requestItems.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
              {t('material.request.requestItemCount', { count: requestItems.length })}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-background/50">
                <tr>
                  <th className="text-left px-3 py-1.5 text-text-muted font-medium w-8">#</th>
                  <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t('common.partName')}</th>
                  <th className="text-right px-3 py-1.5 text-text-muted font-medium">{t('material.request.currentStock')}</th>
                  <th className="text-center px-3 py-1.5 text-text-muted font-medium w-32">{t('material.request.requestQtyLabel')}</th>
                  <th className="text-center px-3 py-1.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {requestItems.map((item, idx) => {
                  const overStock = item.requestQty > item.currentStock;
                  return (
                    <tr key={item.partCode} className="border-t border-border">
                      <td className="px-3 py-1.5 text-text-muted">{idx + 1}</td>
                      <td className="px-3 py-1.5">
                        <span>{item.partName}</span>
                        <span className="ml-2 text-xs text-text-muted">({item.unit})</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">{item.currentStock.toLocaleString()}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={item.requestQty || ''}
                            onChange={(e) => updateQty(item.partCode, Number(e.target.value))}
                            className={`w-full px-2 py-1 text-sm border rounded text-right bg-surface text-text
                              ${overStock ? 'border-red-400' : 'border-border'}`}
                            placeholder="0"
                          />
                          {overStock && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button onClick={() => removeItem(item.partCode)} className="p-1 text-red-400 hover:text-red-600 rounded">
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

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Plus className="w-4 h-4 mr-1" /> {t('material.request.registerRequest')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
