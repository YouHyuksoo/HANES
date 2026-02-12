"use client";

/**
 * @file src/pages/material/receiving/ReceivingPage.tsx
 * @description 입고관리 페이지 - IQC 합격건 수동 입고확정 → 재고 증가
 *
 * 초보자 가이드:
 * 1. **입고확정**: IQC 합격(PASSED)건 중 미입고 건을 수동으로 입고 확정
 * 2. **프로세스**: IQC합격 → 창고/위치 선택 → 입고확정 → 재고 증가
 * 3. **상태**: PASSED(입고대기) → STOCKED(입고완료)
 */
import { PackagePlus, Search, RefreshCw, Clock, CheckCircle, Package, Hash } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import ReceivingTable from '@/components/material/ReceivingTable';
import ReceivingConfirmModal from '@/components/material/ReceivingConfirmModal';
import { useReceivingData, statusFilterOptions } from '@/hooks/material/useReceivingData';

export default function ReceivingPage() {
  const {
    filteredItems,
    stats,
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    isConfirmModalOpen, setIsConfirmModalOpen,
    selectedItem,
    confirmForm, setConfirmForm,
    openConfirmModal,
    handleConfirm,
  } = useReceivingData();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />
            입고관리
          </h1>
          <p className="text-text-muted mt-1">IQC 합격 자재의 입고확정 및 재고 반영을 관리합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="입고대기(합격)" value={stats.pendingCount} icon={Clock} color="yellow" />
        <StatCard label="대기수량" value={stats.pendingQty} icon={Package} color="blue" />
        <StatCard label="금일 입고건수" value={stats.todayStockedCount} icon={CheckCircle} color="green" />
        <StatCard label="금일 입고수량" value={stats.todayStockedQty} icon={Hash} color="purple" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="입하번호, 품목명, LOT번호 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-40">
              <Select options={statusFilterOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <ReceivingTable data={filteredItems} onConfirm={openConfirmModal} />
        </CardContent>
      </Card>

      {/* 입고확정 모달 */}
      <ReceivingConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        selectedItem={selectedItem}
        form={confirmForm}
        setForm={setConfirmForm}
        onSubmit={handleConfirm}
      />
    </div>
  );
}
