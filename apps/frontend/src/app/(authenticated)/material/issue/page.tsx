"use client";

/**
 * @file src/pages/material/issue/IssuePage.tsx
 * @description 출고관리 페이지 - 자재창고 담당자가 출고요청을 승인/처리
 *
 * 초보자 가이드:
 * 1. **출고관리**: 생산현장 요청 건을 승인하고 실제 출고 처리
 * 2. **승인**: 요청 확인 후 출고 가능 상태로 변경
 * 3. **출고처리**: 실제 출고 수량 입력 → 재고 차감
 * 4. **반려**: 재고 부족 등의 사유로 요청 반려
 * 5. **상태 흐름**: REQUESTED → APPROVED → IN_PROGRESS → COMPLETED / REJECTED
 */
import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightFromLine, Search, RefreshCw, Clock, CheckCircle, Play, Package } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import IssueTable from '@/components/material/IssueTable';
import IssueProcessModal from '@/components/material/IssueProcessModal';
import { useIssueData } from '@/hooks/material/useIssueData';
import type { IssueRecord } from '@/hooks/material/useIssueData';

function IssuePage() {
  const { t } = useTranslation();

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'REQUESTED', label: t('material.issue.status.requested') },
    { value: 'APPROVED', label: t('material.issue.status.approved') },
    { value: 'IN_PROGRESS', label: t('material.issue.status.inProgress') },
    { value: 'COMPLETED', label: t('material.issue.status.completed') },
    { value: 'REJECTED', label: t('material.issue.status.rejected') },
  ], [t]);
  const {
    filteredRecords,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
  } = useIssueData();

  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IssueRecord | null>(null);

  const handleApprove = useCallback((record: IssueRecord) => {
    console.log('승인:', record.requestNo, record.partCode);
  }, []);

  const handleReject = useCallback((record: IssueRecord) => {
    console.log('반려:', record.requestNo, record.partCode);
  }, []);

  const handleProcess = useCallback((record: IssueRecord) => {
    setSelectedRecord(record);
    setIsProcessModalOpen(true);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ArrowRightFromLine className="w-7 h-7 text-primary" />
            {t('material.issue.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.issue.description')}</p>
        </div>
      </div>

      {/* 통계카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.issue.stats.requested')} value={stats.requested} icon={Clock} color="yellow" />
        <StatCard label={t('material.issue.stats.approved')} value={stats.approved} icon={CheckCircle} color="blue" />
        <StatCard label={t('material.issue.stats.inProgress')} value={stats.inProgress} icon={Play} color="purple" />
        <StatCard label={t('material.issue.stats.completed')} value={stats.completed} icon={Package} color="green" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('material.issue.searchPlaceholder')}
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
          <IssueTable
            data={filteredRecords}
            onApprove={handleApprove}
            onReject={handleReject}
            onProcess={handleProcess}
          />
        </CardContent>
      </Card>

      {/* 출고처리 모달 */}
      <IssueProcessModal
        isOpen={isProcessModalOpen}
        onClose={() => { setIsProcessModalOpen(false); setSelectedRecord(null); }}
        record={selectedRecord}
      />
    </div>
  );
}

export default IssuePage;
