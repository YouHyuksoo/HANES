'use client';

/**
 * @file src/components/material/IssueRequestTab.tsx
 * @description 출고요청 처리 탭 - 요청 목록 조회, 승인/반려/출고처리
 *
 * 초보자 가이드:
 * 1. **통계카드**: 요청/승인/완료/반려 건수 표시
 * 2. **필터**: 상태 필터 + 텍스트 검색
 * 3. **DataGrid**: 요청 목록 (상태 배지, 액션 버튼)
 * 4. **승인**: ConfirmModal → handleApprove
 * 5. **반려**: 사유입력 모달 → handleReject
 * 6. **출고처리**: IssueFromRequestModal → 일괄 출고
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, RefreshCw, Clock, CheckCircle, Package, XCircle, Play, Ban,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, Button, Input, Select, StatCard, Modal, ConfirmModal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { IssueRequestStatusBadge } from '@/components/material';
import IssueFromRequestModal from '@/components/material/IssueFromRequestModal';
import { useIssueRequests } from '@/hooks/material/useIssueRequests';
import type { IssueRequestRecord } from '@/hooks/material/useIssueRequests';
import type { IssueRequestStatus } from '@/components/material';

export default function IssueRequestTab() {
  const { t } = useTranslation();
  const {
    records, isLoading, refetch, stats,
    statusFilter, setStatusFilter, searchText, setSearchText,
    handleApprove, handleReject,
  } = useIssueRequests();

  // 모달 상태
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [issueTarget, setIssueTarget] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 상태 필터 옵션
  const statusOptions = useMemo(() => [
    { value: '', label: t('common.allStatus') },
    { value: 'REQUESTED', label: t('material.request.status.requested') },
    { value: 'APPROVED', label: t('material.request.status.approved') },
    { value: 'COMPLETED', label: t('material.request.status.completed') },
    { value: 'REJECTED', label: t('material.request.status.rejected') },
  ], [t]);

  // 승인 확인
  const confirmApprove = useCallback(async () => {
    if (!approveTarget) return;
    setIsProcessing(true);
    try {
      await handleApprove(approveTarget);
    } finally {
      setIsProcessing(false);
      setApproveTarget(null);
    }
  }, [approveTarget, handleApprove]);

  // 반려 확인
  const confirmReject = useCallback(async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await handleReject(rejectTarget, rejectReason.trim());
    } finally {
      setIsProcessing(false);
      setRejectTarget(null);
      setRejectReason('');
    }
  }, [rejectTarget, rejectReason, handleReject]);

  // DataGrid 컬럼 정의
  const columns = useMemo<ColumnDef<IssueRequestRecord>[]>(() => [
    { accessorKey: 'requestNo', header: t('material.col.requestNo'), size: 160 },
    { accessorKey: 'requestDate', header: t('material.col.requestDate'), size: 100 },
    {
      accessorKey: 'workOrderNo',
      header: t('material.col.workOrder'),
      size: 160,
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    {
      id: 'itemCount',
      header: t('material.col.itemCount'),
      size: 70,
      cell: ({ row }) => (
        <span>{row.original.itemCount ?? row.original.items?.length ?? 0}{t('material.request.items')}</span>
      ),
    },
    {
      accessorKey: 'totalQty',
      header: t('common.totalQty'),
      size: 100,
      cell: ({ getValue }) => (
        <span className="font-medium">{(getValue() as number)?.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 90,
      cell: ({ getValue }) => (
        <IssueRequestStatusBadge status={getValue() as IssueRequestStatus} />
      ),
    },
    { accessorKey: 'requester', header: t('material.col.requester'), size: 80 },
    {
      id: 'actions',
      header: t('material.col.actions'),
      size: 130,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex gap-1">
            {record.status === 'REQUESTED' && (
              <>
                <button
                  type="button"
                  className="p-1 hover:bg-surface rounded"
                  title={t('material.issue.approveAction')}
                  onClick={() => setApproveTarget(record.id)}
                >
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                </button>
                <button
                  type="button"
                  className="p-1 hover:bg-surface rounded"
                  title={t('material.issue.rejectAction')}
                  onClick={() => setRejectTarget(record.id)}
                >
                  <XCircle className="w-4 h-4 text-red-400" />
                </button>
              </>
            )}
            {record.status === 'APPROVED' && (
              <button
                type="button"
                className="p-1 hover:bg-surface rounded"
                title={t('material.issue.processAction')}
                onClick={() => setIssueTarget(record.id)}
              >
                <Play className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>
        );
      },
    },
  ], [t]);

  return (
    <>
      {/* 통계카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.issue.stats.requested')} value={stats.requested} icon={Clock} color="yellow" />
        <StatCard label={t('material.issue.stats.approved')} value={stats.approved} icon={CheckCircle} color="blue" />
        <StatCard label={t('material.issue.stats.completed')} value={stats.completed} icon={Package} color="green" />
        <StatCard label={t('material.issue.status.rejected')} value={stats.rejected} icon={Ban} color="red" />
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardContent>
          <DataGrid
            data={records}
            columns={columns}
            isLoading={isLoading}
            enableExport
            exportFileName={t('material.request.title')}
            emptyMessage={t('common.noData')}
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
                <Button variant="secondary" size="sm" onClick={() => refetch()} className="flex-shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 승인 확인 모달 */}
      <ConfirmModal
        isOpen={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={confirmApprove}
        title={t('material.issue.approveAction')}
        message={t('material.issue.approveConfirmMsg', { defaultValue: '이 출고요청을 승인하시겠습니까?' })}
        confirmText={t('material.issue.approveAction')}
        isLoading={isProcessing}
      />

      {/* 반려 사유 입력 모달 */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
        title={t('material.issue.rejectAction')}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            {t('material.issue.rejectReasonMsg', { defaultValue: '반려 사유를 입력해주세요.' })}
          </p>
          <Input
            placeholder={t('material.issue.rejectReasonPlaceholder', { defaultValue: '반려 사유 입력...' })}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmReject}
              disabled={!rejectReason.trim()}
              isLoading={isProcessing}
            >
              <XCircle className="w-4 h-4 mr-1" />
              {t('material.issue.rejectAction')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 출고처리 모달 */}
      {issueTarget && (
        <IssueFromRequestModal
          isOpen={!!issueTarget}
          onClose={() => setIssueTarget(null)}
          requestId={issueTarget}
        />
      )}
    </>
  );
}
