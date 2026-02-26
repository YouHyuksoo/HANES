'use client';

/**
 * @file src/components/material/IssueHistoryTab.tsx
 * @description 출고이력 탭 - 전체 출고 이력 조회 및 취소 처리
 *
 * 초보자 가이드:
 * 1. **출고이력**: GET /material/issues 로 전체 이력 조회
 * 2. **취소**: DONE 상태만 취소 가능 (POST /material/issues/:id/cancel)
 * 3. **역분개**: 취소 시 재고 복원 + MAT_OUT_CANCEL 트랜잭션 생성
 * 4. **사유 입력**: 취소 모달에서 사유 입력 필수
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, XCircle } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, Button, Input, Select, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import ComCodeBadge from '@/components/ui/ComCodeBadge';
import { useComCodeOptions } from '@/hooks/useComCode';
import api from '@/services/api';

/** 출고 이력 레코드 타입 */
interface IssueRecord {
  id: string;
  issueNo: string | null;
  issueQty: number;
  issueDate: string;
  issueType: string;
  status: string;
  remark: string | null;
  matUid: string | null;
  itemCode: string | null;
  itemName: string | null;
  unit: string | null;
  jobOrderNo: string | null;
}

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
const getToday = () => new Date().toISOString().slice(0, 10);

export default function IssueHistoryTab() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(getToday);
  const issueTypeOptions = useComCodeOptions('ISSUE_TYPE');
  const [dateTo, setDateTo] = useState(getToday);

  /** 취소 모달 상태 */
  const [cancelTarget, setCancelTarget] = useState<IssueRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.allStatus') },
    { value: 'DONE', label: t('material.issue.history.statusDone') },
    { value: 'CANCELED', label: t('material.issue.history.statusCanceled') },
  ], [t]);

  /** 이력 조회 */
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '200' };
      if (statusFilter) params.status = statusFilter;
      if (issueTypeFilter) params.issueType = issueTypeFilter;
      if (dateFrom) params.issueDateFrom = dateFrom;
      if (dateTo) params.issueDateTo = dateTo;
      const res = await api.get('/material/issues', { params });
      let data: IssueRecord[] = res.data?.data ?? [];
      if (searchText) {
        const keyword = searchText.toLowerCase();
        data = data.filter((r) =>
          r.issueNo?.toLowerCase().includes(keyword) ||
          r.itemCode?.toLowerCase().includes(keyword) ||
          r.itemName?.toLowerCase().includes(keyword) ||
          r.matUid?.toLowerCase().includes(keyword)
        );
      }
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, issueTypeFilter, dateFrom, dateTo]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /** 취소 실행 */
  const handleCancel = useCallback(async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/material/issues/${cancelTarget.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      setCancelTarget(null);
      setCancelReason('');
      fetchRecords();
    } catch (err) {
      console.error('출고 취소 실패:', err);
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelReason, fetchRecords]);

  const handleCloseModal = () => {
    setCancelTarget(null);
    setCancelReason('');
  };

  /** DataGrid 컬럼 */
  const columns = useMemo<ColumnDef<IssueRecord>[]>(() => [
    { accessorKey: 'issueNo', header: t('material.issue.history.issueNo'), size: 180, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'issueDate',
      header: t('material.issue.history.issueDate'),
      size: 100,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10),
    },
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 120, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('common.partName'), size: 150, meta: { filterType: 'text' as const } },
    { accessorKey: 'matUid', header: t('material.col.matUid'), size: 160, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'issueQty',
      header: t('common.quantity'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => {
        const { issueQty, unit } = row.original;
        return (
          <span className="font-medium">
            {issueQty.toLocaleString()} {unit ?? ''}
          </span>
        );
      },
    },
    {
      accessorKey: 'issueType',
      header: t('material.issueAccount'),
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="ISSUE_TYPE" code={getValue() as string} />,
    },
    { accessorKey: 'jobOrderNo', header: t('material.col.workOrder'), size: 160, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const status = getValue() as string;
        const isCanceled = status === 'CANCELED';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isCanceled
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {isCanceled
              ? t('material.issue.history.statusCanceled')
              : t('material.issue.history.statusDone')}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 70,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const record = row.original;
        if (record.status !== 'DONE') return null;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setCancelTarget(record); }}
            className="text-red-500 hover:text-red-700"
            title={t('material.issue.history.cancelAction')}
          >
            <XCircle className="w-4 h-4" />
          </Button>
        );
      },
    },
  ], [t]);

  return (
    <>
      <Card>
        <CardContent>
          <DataGrid
            data={records}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t('material.issue.history.tabTitle')}
            emptyMessage={t('common.noData')}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0 items-center">
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-36"
                  />
                  <span className="text-text-muted text-sm">~</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-36"
                  />
                </div>
                <div className="w-48 min-w-0 flex-shrink-0">
                  <Input
                    placeholder={t('material.issue.history.searchPlaceholder')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Select
                    options={statusOptions}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    fullWidth
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Select
                    options={[{ value: '', label: t('common.all') }, ...issueTypeOptions]}
                    value={issueTypeFilter}
                    onChange={setIssueTypeFilter}
                    fullWidth
                  />
                </div>
                <Button variant="secondary" onClick={() => fetchRecords()} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {t('common.refresh')}
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 출고 취소 모달 */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={handleCloseModal}
        title={t('material.issue.history.cancelTitle')}
        size="lg"
      >
        <div className="space-y-4">
          {cancelTarget && (
            <div className="p-3 bg-surface-secondary rounded-lg space-y-1 text-sm">
              <p>
                <span className="text-text-muted">{t('material.issue.history.issueNo')}:</span>{' '}
                {cancelTarget.issueNo}
              </p>
              <p>
                <span className="text-text-muted">{t('common.partName')}:</span>{' '}
                {cancelTarget.itemName}
              </p>
              <p>
                <span className="text-text-muted">{t('common.quantity')}:</span>{' '}
                {cancelTarget.issueQty.toLocaleString()} {cancelTarget.unit}
              </p>
              <p>
                <span className="text-text-muted">{t('material.col.matUid')}:</span>{' '}
                {cancelTarget.matUid}
              </p>
            </div>
          )}
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('material.issue.history.cancelWarning')}
            </p>
          </div>
          <Input
            label={t('material.issue.history.cancelReason')}
            placeholder={t('material.issue.history.cancelReasonPlaceholder')}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={handleCloseModal}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelling}
            >
              {cancelling ? t('common.processing') : t('material.issue.history.confirmCancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
