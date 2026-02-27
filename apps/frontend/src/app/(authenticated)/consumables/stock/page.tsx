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
import { RefreshCw, Search, Boxes, CheckCircle, Wrench, Clock } from 'lucide-react';
import { Card, CardContent, Button, Input, StatCard } from '@/components/ui';
import { ComCodeSelect } from '@/components/shared';
import StockTable from '@/components/consumables/StockTable';
import { useStockData } from '@/hooks/consumables/useStockData';

function ConsumableStockPage() {
  const { t } = useTranslation();
  const {
    data, isLoading, searchTerm, setSearchTerm, categoryFilter, setCategoryFilter,
    stockStatusFilter, setStockStatusFilter, summary, refresh,
  } = useStockData();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Boxes className="w-7 h-7 text-primary" />{t('consumables.stock.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('consumables.stock.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('consumables.stock.totalInstances')} value={summary.totalItems} icon={Boxes} color="blue" />
        <StatCard label={t('consumables.stock.activeInstances')} value={summary.activeCount} icon={CheckCircle} color="green" />
        <StatCard label={t('consumables.stock.mountedInstances')} value={summary.mountedCount} icon={Wrench} color="purple" />
        <StatCard label={t('consumables.stock.pendingInstances')} value={summary.pendingCount} icon={Clock} color="orange" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
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
                  <ComCodeSelect groupCode="CONSUMABLE_CATEGORY" value={categoryFilter} onChange={setCategoryFilter} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <ComCodeSelect groupCode="CON_STOCK_STATUS" value={stockStatusFilter} onChange={setStockStatusFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default ConsumableStockPage;
