"use client";

/**
 * @file src/pages/consumables/stock/StockPage.tsx
 * @description 소모품 재고현황 메인 페이지
 *
 * 초보자 가이드:
 * 1. **현재고**: 입고 - 출고 누적 결과
 * 2. **안전재고**: 이 수량 이하면 '부족' 경고
 * 3. **재고금액**: 단가 × 현재고
 */
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search, Boxes, AlertTriangle, XCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import StockTable from '@/components/consumables/StockTable';
import { useStockData } from '@/hooks/consumables/useStockData';

function ConsumableStockPage() {
  const { t } = useTranslation();
  const {
    data, searchTerm, setSearchTerm, categoryFilter, setCategoryFilter, summary, refresh,
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
        <StatCard label={t('consumables.stock.totalItems')} value={summary.totalItems} icon={Boxes} color="blue" />
        <StatCard label={t('consumables.stock.belowSafety')} value={summary.belowSafety} icon={AlertTriangle} color="orange" />
        <StatCard label={t('consumables.stock.outOfStock')} value={summary.outOfStock} icon={XCircle} color="red" />
        <StatCard label={t('consumables.stock.totalValue')} value={summary.totalValue.toLocaleString() + t('common.won')} icon={DollarSign} color="green" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('consumables.stock.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <Select
              options={[
                { value: '', label: t('consumables.stock.allCategories') },
                { value: 'MOLD', label: t('consumables.master.mold') },
                { value: 'JIG', label: t('consumables.master.jig') },
                { value: 'TOOL', label: t('consumables.master.tool') },
              ]}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="카테고리"
            />
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <StockTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}

export default ConsumableStockPage;
