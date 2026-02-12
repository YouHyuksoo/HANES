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
import { RefreshCw, Search, Boxes, AlertTriangle, XCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import StockTable from '@/components/consumables/StockTable';
import { useStockData } from '@/hooks/consumables/useStockData';

function ConsumableStockPage() {
  const {
    data, searchTerm, setSearchTerm, categoryFilter, setCategoryFilter, summary, refresh,
  } = useStockData();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Boxes className="w-7 h-7 text-primary" />재고현황
          </h1>
          <p className="text-text-muted mt-1">소모품 현재고 및 재고 상태를 조회합니다.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="전체 품목수" value={summary.totalItems} icon={Boxes} color="blue" />
        <StatCard label="재고부족" value={summary.belowSafety} icon={AlertTriangle} color="orange" />
        <StatCard label="재고없음" value={summary.outOfStock} icon={XCircle} color="red" />
        <StatCard label="총 재고금액" value={summary.totalValue.toLocaleString() + '원'} icon={DollarSign} color="green" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="소모품코드, 명칭 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <Select
              options={[
                { value: '', label: '전체 카테고리' },
                { value: 'MOLD', label: '금형' },
                { value: 'JIG', label: '지그' },
                { value: 'TOOL', label: '공구' },
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
