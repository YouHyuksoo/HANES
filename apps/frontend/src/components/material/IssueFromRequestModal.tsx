'use client';

/**
 * @file src/components/material/IssueFromRequestModal.tsx
 * @description 출고요청 기반 출고 모달 - 요청 상세 조회 후 품목별 LOT 선택/출고
 *
 * 초보자 가이드:
 * 1. **요청 상세**: requestId로 출고요청 상세 정보 조회
 * 2. **품목별 테이블**: 요청수량, 기출고량, 잔여량, 출고수량 표시
 * 3. **일괄 출고**: POST /material/issue-requests/:id/issue 호출
 * 4. **성공 시**: 모달 닫기 + 쿼리 무효화 (목록 자동 새로고침)
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Package, AlertTriangle } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Modal, Button, Input } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';

interface IssueFromRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
}

/** 요청 상세의 품목 */
interface RequestDetailItem {
  id: string;
  partCode: string;
  partName: string;
  unit: string;
  requestQty: number;
  issuedQty: number;
}

/** 요청 상세 응답 */
interface RequestDetail {
  id: string;
  requestNo: string;
  workOrderNo: string;
  requester: string;
  status: string;
  items: RequestDetailItem[];
}

/** 출고 입력 행 */
interface IssueRow extends RequestDetailItem {
  remainQty: number;
  issueQty: number;
}

export default function IssueFromRequestModal({
  isOpen, onClose, requestId,
}: IssueFromRequestModalProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();
  const [issueRows, setIssueRows] = useState<IssueRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 요청 상세 조회
  const { data, isLoading } = useApiQuery<RequestDetail>(
    ['issue-request-detail', requestId],
    `/material/issue-requests/${requestId}`,
    { enabled: isOpen && !!requestId },
  );

  const detail = useMemo(() => {
    const raw = data?.data;
    return raw ?? null;
  }, [data]);

  // 상세 데이터 → 출고 입력 행 변환
  useEffect(() => {
    if (!detail?.items) return;
    setIssueRows(
      detail.items.map((item) => ({
        ...item,
        remainQty: item.requestQty - (item.issuedQty ?? 0),
        issueQty: item.requestQty - (item.issuedQty ?? 0), // 기본값: 잔여량
      })),
    );
  }, [detail]);

  // 출고수량 변경
  const handleQtyChange = useCallback((itemId: string, qty: number) => {
    setIssueRows((prev) =>
      prev.map((row) =>
        row.id === itemId ? { ...row, issueQty: Math.max(0, Math.min(qty, row.remainQty)) } : row,
      ),
    );
  }, []);

  // 총 출고수량
  const totalIssueQty = useMemo(
    () => issueRows.reduce((sum, r) => sum + (r.issueQty || 0), 0),
    [issueRows],
  );

  // 일괄 출고 처리
  const handleSubmit = useCallback(async () => {
    const validRows = issueRows.filter((r) => r.issueQty > 0);
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.post(`/material/issue-requests/${requestId}/issue`, {
        items: validRows.map((r) => ({ itemId: r.id, issueQty: r.issueQty })),
      });
      invalidate(['issue-requests']);
      invalidate(['issue-request-detail']);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(axiosErr.response?.data?.message || '출고 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [issueRows, requestId, invalidate, onClose]);

  // 컬럼 정의
  const columns = useMemo<ColumnDef<IssueRow>[]>(() => [
    { accessorKey: 'partCode', header: t('common.partCode', { defaultValue: '품목코드' }), size: 120 },
    { accessorKey: 'partName', header: t('common.partName', { defaultValue: '품목명' }), size: 150 },
    {
      accessorKey: 'requestQty',
      header: t('material.col.requestQty'),
      size: 100,
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'issuedQty',
      header: t('material.issue.issuedLabel'),
      size: 90,
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'remainQty',
      header: t('material.issue.remainingLabel'),
      size: 90,
      cell: ({ getValue }) => (
        <span className="font-medium text-primary">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'issueQtyInput',
      header: t('material.issue.issueQtyLabel'),
      size: 120,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Input
            type="number"
            value={String(item.issueQty)}
            onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
            className="w-24 text-right"
            min={0}
            max={item.remainQty}
          />
        );
      },
    },
    { accessorKey: 'unit', header: t('common.unit'), size: 60 },
  ], [t, handleQtyChange]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.issue.processAction')} size="xl">
      <div className="space-y-4">
        {/* 요청 정보 */}
        {detail && (
          <div className="p-3 bg-background rounded-lg dark:bg-slate-800 grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-text-muted">{t('material.col.requestNo')}:</span>{' '}
              <span className="font-medium text-text">{detail.requestNo}</span>
            </div>
            <div>
              <span className="text-text-muted">{t('material.col.workOrder')}:</span>{' '}
              <span className="font-medium text-primary">{detail.workOrderNo}</span>
            </div>
            <div>
              <span className="text-text-muted">{t('material.col.requester')}:</span>{' '}
              <span className="font-medium text-text">{detail.requester}</span>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* 품목 테이블 */}
        <DataGrid
          data={issueRows}
          columns={columns}
          isLoading={isLoading}
          emptyMessage={t('common.noData')}
        />

        {/* 하단 요약 + 버튼 */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-text-muted">
            {t('material.issue.totalIssueQty', { defaultValue: '총 출고수량' })}:{' '}
            <span className="font-bold text-text">{totalIssueQty.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={totalIssueQty <= 0}
              isLoading={isSubmitting}
            >
              <Package className="w-4 h-4 mr-1" />
              {t('material.issue.issueAction')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
