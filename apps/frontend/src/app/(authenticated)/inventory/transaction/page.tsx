"use client";

/**
 * @file src/pages/inventory/TransactionPage.tsx
 * @description 수불 이력 페이지 - 입고/출고/이동/취소 내역 조회 및 처리
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RefreshCw, Search, Calendar } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { api } from '@/services/api';
import { getTodayLocal } from '@/utils/date';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { createTransactionGridColumns, type TransactionData } from './transactionColumns';

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
const getToday = () => getTodayLocal();

/** 1개월 전 날짜를 YYYY-MM-DD 형식으로 반환 */
const getOneMonthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return getTodayLocal(d);
};

export default function TransactionPage() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [matUidInput, setMatUidInput] = useState('');

  const TRANS_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'RECEIVE', label: t('inventory.transaction.receive', '입고') },
    { value: 'MAT_OUT', label: t('inventory.transaction.matOut') },
    { value: 'MAT_OUT_CANCEL', label: t('inventory.transaction.matOutCancel') },
    { value: 'LOT_SPLIT_IN', label: t('inventory.transaction.lotSplitIn', 'LOT분할(입)') },
    { value: 'LOT_SPLIT_OUT', label: t('inventory.transaction.lotSplitOut', 'LOT분할(출)') },
    { value: 'ADJUST_IN', label: t('inventory.transaction.adjPlus') },
    { value: 'ADJUST_OUT', label: t('inventory.transaction.adjMinus') },
    { value: 'MISC_IN', label: t('inventory.transaction.miscIn', '기타입고') },
    { value: 'TRANSFER', label: t('inventory.transaction.transfer') },
    { value: 'MAT_MOVE_OUT', label: t('inventory.transaction.matMoveOut', '불용이동(출)') },
    { value: 'MAT_MOVE_IN', label: t('inventory.transaction.matMoveIn', '불용이동(입)') },
    { value: 'WIP_MOVE', label: t('inventory.transaction.wipMove') },
    { value: 'WIP_MOVE_CANCEL', label: t('inventory.transaction.wipMoveCancel') },
    { value: 'PROD_CONSUME', label: t('inventory.transaction.prodConsume') },
    { value: 'PROD_CONSUME_CANCEL', label: t('inventory.transaction.prodConsumeCancel') },
    { value: 'SCRAP', label: t('inventory.transaction.scrap') },
  ], [t]);

  const getTransTypeLabel = (type: string) => {
    return TRANS_TYPES.find(tt => tt.value === type)?.label || type;
  };

  // 필터 (날짜 기본값: 최근 1개월)
  const [filters, setFilters] = useState({
    transType: '',
    fromDate: getOneMonthAgo(),
    toDate: getToday(),
  });

  const fetchTransactions = useCallback(async () => {
    if (!filters.fromDate || !filters.toDate) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.transType) params.append('transType', filters.transType);
      params.append('fromDate', filters.fromDate);
      params.append('toDate', filters.toDate);

      const res = await api.get(`/inventory/transactions?${params.toString()}`);
      const result = res.data?.data ?? res.data;
      const items = Array.isArray(result) ? result : [];
      setTransactions(items);
    } catch (error) {
      console.error('수불 이력 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // 품목 시리얼(matUid) 부분 검색 — 조회된 목록 대상 client-side contains 필터
  const displayedTransactions = useMemo(() => {
    const kw = matUidInput.trim().toLowerCase();
    if (!kw) return transactions;
    return transactions.filter((tr) =>
      (tr.matUid || tr.lot?.matUid || '').toLowerCase().includes(kw),
    );
  }, [transactions, matUidInput]);

  const columns = useMemo(() => createTransactionGridColumns({
    t,
    getTransTypeLabel,
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />{t('inventory.transaction.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('inventory.transaction.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchTransactions}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={displayedTransactions}
            columns={columns}
            isLoading={loading}
            emptyMessage={t('inventory.transaction.emptyMessage')}
            enableColumnFilter
            enableExport
            exportFileName="거래내역"
            toolbarLeft={
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <DateRangeFilter
                  from={filters.fromDate}
                  to={filters.toDate}
                  onFromChange={(v) => setFilters({ ...filters, fromDate: v })}
                  onToChange={(v) => setFilters({ ...filters, toDate: v })}
                  className="flex-shrink-0"
                />
                <Select options={TRANS_TYPES} value={filters.transType} onChange={(v) => setFilters({ ...filters, transType: v })} placeholder={t('inventory.transaction.transType')} />
                <div className="flex-1 min-w-0">
                  <Input
                    value={matUidInput}
                    onChange={(e) => setMatUidInput(e.target.value)}
                    placeholder={t('inventory.transaction.searchMatUid')}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM STOCK_TRANSACTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
