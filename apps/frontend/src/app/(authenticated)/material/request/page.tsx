"use client";

/**
 * @file src/pages/material/issue-request/IssueRequestPage.tsx
 * @description 출고요청 페이지 - 좌측 작업지시 선택 → 우측 BOM 기준 출고요청 상세 그리드
 *
 * 초보자 가이드:
 * 1. **작업지시 기준**: 좌측 목록에서 작업지시를 선택하면 BOM 기준 출고 예정 원자재가 그리드에 표시
 * 2. **요청수량 입력**: 그리드에서 수량을 입력하고 출고요청을 등록
 * 3. **현재고 표시**: 요청 시 현재고를 확인하여 적정 수량 요청
 * 4. **상태 흐름**: 대기 → 승인 → 출고완료 / 반려
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import RequestModal from '@/components/material/RequestModal';
import IssueRequestDetailModal from '@/components/material/IssueRequestDetailModal';
import WorkOrderRequestPanel from '@/components/material/WorkOrderRequestPanel';
import { useIssueRequestData, type IssueRequest } from '@/hooks/material/useIssueRequestData';

function IssueRequestPage() {
  const { t } = useTranslation();

  const {
    filteredRequests,
    searchStockItems,
    loadBomRequestItems,
    loadRequestsByOrder,
    jobOrders,
    isLoadingJobOrders,
    woOrderNo,
    setWoOrderNo,
    woModel,
    setWoModel,
    woStatus,
    setWoStatus,
    workOrderOptions,
    isLoading,
  } = useIssueRequestData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<IssueRequest | null>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t('material.request.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.request.description')}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t('material.request.manualRequest')}
        </Button>
      </div>

      {/* 작업지시 master-detail 패널 (상단 조건 필터 바 포함) */}
      <WorkOrderRequestPanel
        jobOrders={jobOrders}
        isLoadingJobOrders={isLoadingJobOrders}
        loadBomRequestItems={loadBomRequestItems}
        loadRequestsByOrder={loadRequestsByOrder}
        woOrderNo={woOrderNo}
        onWoOrderNoChange={setWoOrderNo}
        woModel={woModel}
        onWoModelChange={setWoModel}
        woStatus={woStatus}
        onWoStatusChange={setWoStatus}
        recentRequests={filteredRequests}
        isLoadingRequests={isLoading}
        onViewRequestDetail={setDetailTarget}
      />

      {/* 수동 출고요청 모달 (작업지시 없는 임시 요청용) */}
      <RequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        searchStockItems={searchStockItems}
        loadBomRequestItems={loadBomRequestItems}
        workOrderOptions={workOrderOptions}
      />

      <IssueRequestDetailModal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        request={detailTarget}
      />
    </div>
  );
}

export default IssueRequestPage;
