'use client';

/**
 * @file src/components/material/ManualIssueTab.tsx
 * @description 수동출고 탭 - 가용재고 목록에서 직접 선택하여 출고 처리
 *
 * 초보자 가이드:
 * 1. **가용재고**: IQC PASS된 LOT만 표시
 * 2. **체크박스 선택**: 클릭하면 출고수량 기본값 = 가용수량
 * 3. **출고수량 편집**: 가용수량 이내로 수량 조절 가능
 * 4. **일괄 출고**: 선택된 품목들을 한 번에 출고 처리
 * 5. **창고 필터**: useWarehouseOptions()로 창고 드롭다운
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Package, AlertTriangle } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, Button, Input, Select, ConfirmModal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useManualIssue } from '@/hooks/material/useManualIssue';
import { useWarehouseOptions } from '@/hooks/useMasterOptions';
import { useComCodeOptions } from '@/hooks/useComCode';
import type { AvailableStock } from '@/hooks/material/useManualIssue';

export default function ManualIssueTab() {
  const { t } = useTranslation();
  const {
    availableStocks, isLoading, refetch,
    warehouseFilter, setWarehouseFilter,
    searchText, setSearchText,
    issueType, setIssueType,
    selectedItems, toggleSelect, updateQty, toggleAll,
    totalIssueQty, handleIssue,
  } = useManualIssue();
  const issueTypeOptions = useComCodeOptions('ISSUE_TYPE');

  const { options: warehouseRawOptions } = useWarehouseOptions('RAW');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 창고 필터 옵션 (전체 포함)
  const warehouseOptions = useMemo(() => [
    { value: '', label: t('material.stock.allWarehouse', { defaultValue: '전체 창고' }) },
    ...warehouseRawOptions,
  ], [t, warehouseRawOptions]);

  // 출고 실행
  const confirmIssue = useCallback(async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await handleIssue();
      setShowConfirm(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(axiosErr.response?.data?.message || '출고 처리에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [handleIssue]);

  // DataGrid 컬럼 정의
  const columns = useMemo<ColumnDef<AvailableStock>[]>(() => [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={availableStocks.length > 0 && selectedItems.size === availableStocks.length}
          onChange={() => toggleAll(availableStocks)}
          className="w-4 h-4 rounded border-border"
        />
      ),
      size: 40,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const stock = row.original;
        return (
          <input
            type="checkbox"
            checked={selectedItems.has(stock.id)}
            onChange={() => toggleSelect(stock.id, stock.availableQty)}
            className="w-4 h-4 rounded border-border"
          />
        );
      },
    },
    {
      accessorKey: 'warehouseName',
      header: t('material.col.warehouse', { defaultValue: '창고' }),
      size: 100,
      meta: { filterType: 'text' as const },
    },
    { accessorKey: 'itemCode', header: t('common.partCode', { defaultValue: '품목코드' }), size: 120, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('common.partName', { defaultValue: '품목명' }), size: 150, meta: { filterType: 'text' as const } },
    { accessorKey: 'matUid', header: t('material.col.matUid'), size: 150, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'iqcStatus',
      header: 'IQC',
      size: 70,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'availableQty',
      header: t('material.issue.availableQty', { defaultValue: '가용수량' }),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => (
        <span className="font-medium">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'issueQty',
      header: t('material.issue.issueQtyLabel'),
      size: 120,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const stock = row.original;
        const isSelected = selectedItems.has(stock.id);
        const currentQty = selectedItems.get(stock.id) ?? 0;
        return isSelected ? (
          <Input
            type="number"
            value={String(currentQty)}
            onChange={(e) => updateQty(stock.id, Math.max(0, Math.min(Number(e.target.value), stock.availableQty)))}
            className="w-24 text-right"
            min={0}
            max={stock.availableQty}
          />
        ) : (
          <span className="text-text-muted">-</span>
        );
      },
    },
    {
      accessorKey: 'unit',
      header: t('common.unit'),
      size: 60,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-text-muted">{getValue() as string ?? 'EA'}</span>,
    },
  ], [t, availableStocks, selectedItems, toggleAll, toggleSelect, updateQty]);

  return (
    <>
      <Card>
        <CardContent>
          {/* 에러 메시지 */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* 테이블 */}
          <DataGrid
            data={availableStocks}
            columns={columns}
            isLoading={isLoading}
            enableColumnFilter
            enableExport
            exportFileName={t('material.issue.manualIssue', { defaultValue: '수동출고' })}
            emptyMessage={t('material.issue.noAvailableStock', { defaultValue: '출고 가능한 재고가 없습니다.' })}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('material.stock.searchPlaceholder', { defaultValue: '품목코드, 품목명, LOT번호 검색...' })}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-44 flex-shrink-0">
                  <Select
                    options={warehouseOptions}
                    value={warehouseFilter}
                    onChange={setWarehouseFilter}
                    fullWidth
                  />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select
                    options={issueTypeOptions}
                    value={issueType}
                    onChange={setIssueType}
                    required
                    fullWidth
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={() => refetch()} className="flex-shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            }
          />

          {/* 하단 선택 요약 + 출고 버튼 */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="text-sm text-text-muted">
              {t('common.selected', { defaultValue: '선택' })}{' '}
              <span className="font-bold text-text">{selectedItems.size}</span>{t('common.count')}{' | '}
              {t('material.issue.totalIssueQty', { defaultValue: '총 출고수량' })}:{' '}
              <span className="font-bold text-text">{totalIssueQty.toLocaleString()}</span>
            </div>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={selectedItems.size === 0 || !issueType}
            >
              <Package className="w-4 h-4 mr-1" />
              {t('material.issue.processAction')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 출고 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmIssue}
        title={t('material.issue.processAction')}
        message={t('material.issue.issueConfirmMsg', {
          defaultValue: `선택한 ${selectedItems.size}건 (총 ${totalIssueQty.toLocaleString()})을 출고 처리하시겠습니까?`,
          count: selectedItems.size,
          qty: totalIssueQty.toLocaleString(),
        })}
        confirmText={t('material.issue.issueAction')}
        isLoading={isProcessing}
      />
    </>
  );
}
