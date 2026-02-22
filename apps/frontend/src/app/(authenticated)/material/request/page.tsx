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
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Plus, Search, RefreshCw, Clock, CheckCircle, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import RequestTable from '@/components/material/RequestTable';
import RequestModal from '@/components/material/RequestModal';
import { useIssueRequestData } from '@/hooks/material/useIssueRequestData';

function IssueRequestPage() {
  const { t } = useTranslation();

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'REQUESTED', label: t('material.request.status.requested') },
    { value: 'APPROVED', label: t('material.request.status.approved') },
    { value: 'COMPLETED', label: t('material.request.status.completed') },
    { value: 'REJECTED', label: t('material.request.status.rejected') },
  ], [t]);
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
            {t('material.request.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.request.description')}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t('material.request.title')}
        </Button>
      </div>

      {/* 통계카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.request.stats.requested')} value={stats.requested} icon={Clock} color="yellow" />
        <StatCard label={t('material.request.stats.approved')} value={stats.approved} icon={CheckCircle} color="blue" />
        <StatCard label={t('material.request.stats.completed')} value={stats.completed} icon={Package} color="green" />
        <StatCard label={t('material.request.stats.totalPending')} value={stats.totalPending} icon={AlertCircle} color="gray" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <RequestTable
            data={filteredRequests}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('material.request.searchPlaceholder')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select
                    options={statusOptions}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    fullWidth
                  />
                </div>
              </div>
            }
          />
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
