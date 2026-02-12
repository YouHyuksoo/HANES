"use client";

/**
 * @file src/pages/consumables/receiving/ReceivingPage.tsx
 * @description 소모품 입고관리 메인 페이지
 *
 * 초보자 가이드:
 * 1. **입고(IN)**: 공급업체에서 소모품을 받아 등록
 * 2. **입고반품(IN_RETURN)**: 불량/오배송 등으로 공급업체에 반품
 * 3. **통계카드**: 금일 입고건수, 입고금액, 반품건수 표시
 */
import { useState } from 'react';
import { Plus, RefreshCw, Search, ArrowDownCircle, DollarSign, Undo2, PackagePlus } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import ReceivingTable from '@/components/consumables/ReceivingTable';
import ReceivingModal from '@/components/consumables/ReceivingModal';
import ReceivingReturnModal from '@/components/consumables/ReceivingReturnModal';
import { useReceivingData } from '@/hooks/consumables/useReceivingData';

function ReceivingPage() {
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const {
    data, searchTerm, setSearchTerm, typeFilter, setTypeFilter, todayStats, refresh,
  } = useReceivingData();

  const handleReceivingSubmit = (formData: any) => {
    // TODO: API 호출
    console.log('입고 등록:', { ...formData, logType: 'IN' });
  };

  const handleReturnSubmit = (formData: any) => {
    // TODO: API 호출
    console.log('입고반품 등록:', { ...formData, logType: 'IN_RETURN' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />입고관리
          </h1>
          <p className="text-text-muted mt-1">소모품 입고 및 입고반품을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsReturnModalOpen(true)}>
            <Undo2 className="w-4 h-4 mr-1" /> 입고반품
          </Button>
          <Button size="sm" onClick={() => setIsReceivingModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> 입고등록
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="금일 입고건수" value={todayStats.inCount} icon={ArrowDownCircle} color="green" />
        <StatCard label="금일 입고금액" value={todayStats.inAmount.toLocaleString() + '원'} icon={DollarSign} color="blue" />
        <StatCard label="금일 반품건수" value={todayStats.returnCount} icon={Undo2} color="orange" />
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
                { value: '', label: '전체 유형' },
                { value: 'IN', label: '입고' },
                { value: 'IN_RETURN', label: '입고반품' },
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="유형"
            />
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <ReceivingTable data={data} />
        </CardContent>
      </Card>

      {/* 모달 */}
      <ReceivingModal
        isOpen={isReceivingModalOpen}
        onClose={() => setIsReceivingModalOpen(false)}
        onSubmit={handleReceivingSubmit}
      />
      <ReceivingReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSubmit={handleReturnSubmit}
      />
    </div>
  );
}

export default ReceivingPage;
