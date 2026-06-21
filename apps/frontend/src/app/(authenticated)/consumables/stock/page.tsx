"use client";

/**
 * @file src/app/(authenticated)/consumables/stock/page.tsx
 * @description 소모품 재고현황 메인 페이지 — conUid별 개별 인스턴스 조회
 *
 * 초보자 가이드:
 * 1. **conUid**: 소모품 개별 식별번호 (라벨 바코드)
 * 2. **인스턴스 상태**: PENDING(미입고), ACTIVE(사용가능), MOUNTED(장착중) 등
 * 3. **사용횟수**: currentCount / expectedLife 비율로 수명 표시
 */
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { ComCodeSelect } from '@/components/shared';
import StockTable from '@/components/consumables/StockTable';
import { useStockData } from '@/hooks/consumables/useStockData';

function ConsumableStockPage() {
  const { t } = useTranslation();
  const {
    data, isLoading, searchTerm, setSearchTerm, categoryFilter, setCategoryFilter,
    stockStatusFilter, setStockStatusFilter, refresh,
  } = useStockData();

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text">{t('consumables.stock.title')}</h1>
          <p className="text-xs text-text-muted">{t('consumables.stock.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
        </Button>
      </div>

      {/* 테이블 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <StockTable
          data={data}
          isLoading={isLoading}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t('consumables.stock.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-36 flex-shrink-0">
                <ComCodeSelect groupCode="CONSUMABLE_CATEGORY" value={categoryFilter} onChange={setCategoryFilter} labelPrefix={t("consumables.life.categoryLabel", "분류")} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <ComCodeSelect groupCode="CON_STOCK_STATUS" value={stockStatusFilter} onChange={setStockStatusFilter} labelPrefix={t("consumables.comp.stockStatus", "재고상태")} fullWidth />
              </div>
            </div>
          }
        />
      </CardContent></Card>
    </div>
  );
}

export default ConsumableStockPage;
