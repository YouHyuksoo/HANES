"use client";

/**
 * @file src/pages/material/issue-request/IssueRequestPage.tsx
 * @description 출고요청 페이지 - 생산현장 담당자가 복수 품목을 한번에 출고 요청
 *
 * 초보자 가이드:
 * 1. **출고요청**: 작업지시에 필요한 자재를 자재창고에 요청
 * 2. **복수 품목**: 한 번에 여러 품목을 검색하여 장바구니처럼 추가
 * 3. **현재고 표시**: 요청 시 현재고를 확인하여 적정 수량 요청
 * 4. **상태 흐름**: 대기 → 승인 → 출고완료 / 반려
 */
import { useState } from 'react';
import { ClipboardList, Plus, Search, RefreshCw, Clock, CheckCircle, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import RequestTable from '@/components/material/RequestTable';
import RequestModal from '@/components/material/RequestModal';
import { useIssueRequestData } from '@/hooks/material/useIssueRequestData';

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'REQUESTED', label: '대기' },
  { value: 'APPROVED', label: '승인' },
  { value: 'COMPLETED', label: '출고완료' },
  { value: 'REJECTED', label: '반려' },
];

function IssueRequestPage() {
  const {
    filteredRequests,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    searchStockItems,
    workOrderOptions,
  } = useIssueRequestData();

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            출고요청
          </h1>
          <p className="text-text-muted mt-1">작업지시에 필요한 자재를 출고 요청합니다.</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> 출고요청
        </Button>
      </div>

      {/* 통계카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="내 요청(대기)" value={stats.requested} icon={Clock} color="yellow" />
        <StatCard label="내 요청(승인)" value={stats.approved} icon={CheckCircle} color="blue" />
        <StatCard label="내 요청(완료)" value={stats.completed} icon={Package} color="green" />
        <StatCard label="전체 대기건" value={stats.totalPending} icon={AlertCircle} color="gray" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="요청번호, 작업지시 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-40">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                fullWidth
              />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <RequestTable data={filteredRequests} />
        </CardContent>
      </Card>

      {/* 출고요청 모달 */}
      <RequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        searchStockItems={searchStockItems}
        workOrderOptions={workOrderOptions}
      />
    </div>
  );
}

export default IssueRequestPage;
