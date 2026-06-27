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
import { CheckCircle, Package, AlertTriangle, Info } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Modal, Button, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';
import { useComCodeOptions } from '@/hooks/useComCode';

interface IssueFromRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
}

/** 요청 상세의 품목 */
interface RequestDetailItem {
  id: string;
  seq?: number;
  itemCode: string;
  itemName: string;
  unit: string;
  requestQty: number;
  issuedQty: number;
  /** 포장단위(최소 출고 단위) */
  minPackQty?: number;
}

/** 실출고수량 = ceil(잔여/포장단위)*포장단위. 포장단위<=0이면 잔여 그대로 */
const roundUpToPack = (qty: number, minPackQty: number) =>
  minPackQty > 0 && qty > 0 ? Math.ceil(qty / minPackQty) * minPackQty : qty;

/** 요청 상세 응답 */
interface RequestDetail {
  id: string;
  requestNo: string;
  workOrderNo: string;
  requester: string;
  status: string;
  issueType?: string;
  /** 출고 대상 공정(지정 시 공정재고로 적재) */
  processCode?: string | null;
  items: RequestDetailItem[];
}

/** 출고 입력 행 */
interface IssueRow extends RequestDetailItem {
  rowKey: string;
  seq: number;
  remainQty: number;
  /** 포장단위 올림 잔여(최대 출고 허용 수량) */
  packRemainQty: number;
  issueQty: number;
}

interface AvailableStock {
  id?: string;
  matUid: string;
  itemCode: string;
  warehouseCode: string;
  warehouseName?: string;
  availableQty?: number;
  qty?: number;
  unit?: string;
  /** 입고일(FIFO 선입선출 가시화) */
  recvDate?: string | null;
}

/** 입고일 표시용 포맷 (YYYY-MM-DD) */
const fmtRecvDate = (v?: string | null) => (v ? String(v).slice(0, 10) : '-');

export default function IssueFromRequestModal({
  isOpen, onClose, requestId,
}: IssueFromRequestModalProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();
  const issueTypeOptions = useComCodeOptions('ISSUE_TYPE');
  const [issueType, setIssueType] = useState<string>('PRODUCTION');
  const [issueRows, setIssueRows] = useState<IssueRow[]>([]);
  const [availableStocksByItem, setAvailableStocksByItem] = useState<Record<string, AvailableStock[]>>({});
  const [selectedMatUids, setSelectedMatUids] = useState<Record<string, string>>({});
  const [isLoadingLots, setIsLoadingLots] = useState(false);
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
      detail.items.map((item) => {
        const seq = Number(item.seq ?? item.id);
        const remainQty = item.requestQty - (item.issuedQty ?? 0);
        const packRemainQty = roundUpToPack(remainQty, Number(item.minPackQty ?? 0));
        return {
          ...item,
          rowKey: String(seq || item.itemCode),
          seq,
          remainQty,
          packRemainQty,
          issueQty: packRemainQty, // 기본값: 포장단위 올림 잔여(실출고수량)
        };
      }),
    );
    // 요청에 issueType이 있으면 기본값 설정
    if (detail.issueType) {
      setIssueType(detail.issueType);
    }
  }, [detail]);

  useEffect(() => {
    if (!isOpen || issueRows.length === 0) return;
    let isMounted = true;
    const itemCodes = [...new Set(issueRows.map((row) => row.itemCode).filter(Boolean))];

    const loadAvailableLots = async () => {
      setIsLoadingLots(true);
      setErrorMsg(null);
      try {
        const entries = await Promise.all(itemCodes.map(async (itemCode) => {
          const res = await api.get('/material/stocks/available', {
            params: { itemCode, limit: 100 },
          });
          const raw = res.data?.data;
          const rows = (Array.isArray(raw) ? raw : raw?.data ?? []) as AvailableStock[];
          return [itemCode, rows.filter((row) => row.matUid && (row.availableQty ?? row.qty ?? 0) > 0)] as const;
        }));
        if (!isMounted) return;
        const nextByItem = Object.fromEntries(entries);
        setAvailableStocksByItem(nextByItem);
        setSelectedMatUids((prev) => {
          const next = { ...prev };
          for (const row of issueRows) {
            if (next[row.rowKey]) continue;
            const candidates = nextByItem[row.itemCode] ?? [];
            const preferred = candidates.find((stock) => (stock.availableQty ?? stock.qty ?? 0) >= row.issueQty)
              ?? candidates[0];
            if (preferred?.matUid) next[row.rowKey] = preferred.matUid;
          }
          return next;
        });
      } catch (err: unknown) {
        if (!isMounted) return;
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setErrorMsg(axiosErr.response?.data?.message || '출고 가능 LOT 조회에 실패했습니다.');
      } finally {
        if (isMounted) setIsLoadingLots(false);
      }
    };

    void loadAvailableLots();
    return () => {
      isMounted = false;
    };
  }, [isOpen, issueRows]);

  // 출고수량 변경
  const handleQtyChange = useCallback((rowKey: string, qty: number) => {
    setIssueRows((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey ? { ...row, issueQty: Math.max(0, Math.min(qty, row.packRemainQty)) } : row,
      ),
    );
  }, []);

  const handleLotChange = useCallback((rowKey: string, matUid: string) => {
    setSelectedMatUids((prev) => ({ ...prev, [rowKey]: matUid }));
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
    const missingLot = validRows.find((r) => !selectedMatUids[r.rowKey]);
    if (missingLot) {
      setErrorMsg(`${missingLot.itemCode} 출고 LOT를 선택해주세요.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.post(`/material/issue-requests/${requestId}/issue`, {
        items: validRows.map((r) => ({
          requestItemId: String(r.seq),
          matUid: selectedMatUids[r.rowKey],
          issueQty: r.issueQty,
        })),
        issueType,
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
  }, [issueRows, requestId, issueType, selectedMatUids, invalidate, onClose]);

  // 컬럼 정의
  const columns = useMemo<ColumnDef<IssueRow>[]>(() => [
    { accessorKey: 'itemCode', header: t('common.partCode', { defaultValue: '품목코드' }), size: 120, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('common.partName', { defaultValue: '품목명' }), size: 150, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'requestQty',
      header: t('material.col.requestQty'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span>{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'issuedQty',
      header: t('material.issue.issuedLabel'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span>{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'remainQty',
      header: t('material.issue.remainingLabel'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => (
        <span className="font-medium text-primary">{((getValue() as number) ?? 0).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'minPackQty',
      header: t('material.request.minPackQty', { defaultValue: '포장단위' }),
      size: 80,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => {
        const v = (getValue() as number) ?? 0;
        return <span className="text-text-muted">{v > 0 ? v.toLocaleString() : '-'}</span>;
      },
    },
    {
      id: 'matUidSelect',
      header: '출고 LOT',
      size: 220,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const item = row.original;
        // 백엔드가 입고일(FIFO) 오름차순으로 정렬 → 첫 항목이 선입선출 권장 LOT
        const options = (availableStocksByItem[item.itemCode] ?? []).map((stock, i) => ({
          value: stock.matUid,
          label: `${i === 0 ? '⭐ ' : ''}${stock.matUid} · ${stock.warehouseName ?? stock.warehouseCode} · ${(stock.availableQty ?? stock.qty ?? 0).toLocaleString()}${stock.unit ? ` ${stock.unit}` : ''} · 📅${fmtRecvDate(stock.recvDate)}`,
        }));
        return (
          <Select
            options={options}
            value={selectedMatUids[item.rowKey] ?? ''}
            onChange={(value) => handleLotChange(item.rowKey, value)}
            placeholder={isLoadingLots ? 'LOT 조회 중' : 'LOT 선택'}
            fullWidth
            disabled={isLoadingLots || options.length === 0}
          />
        );
      },
    },
    {
      id: 'issueQtyInput',
      header: t('material.issue.issueQtyLabel'),
      size: 120,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const item = row.original;
        // 선택한 LOT의 가용재고가 출고수량보다 적으면 사전 경고(백엔드도 차단)
        const selectedStock = (availableStocksByItem[item.itemCode] ?? []).find(
          (s) => s.matUid === selectedMatUids[item.rowKey],
        );
        const availQty = selectedStock?.availableQty ?? selectedStock?.qty ?? 0;
        const shortage = !!selectedMatUids[item.rowKey] && availQty < item.issueQty;
        return (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={String(item.issueQty)}
              onChange={(e) => handleQtyChange(item.rowKey, Number(e.target.value))}
              className={`w-24 text-right ${shortage ? 'border-red-400' : ''}`}
              min={0}
              max={item.packRemainQty}
            />
            {shortage && (
              <AlertTriangle
                className="w-4 h-4 text-red-500 shrink-0"
                aria-label={t('material.issue.lotShortage', { defaultValue: '선택 LOT 가용재고 부족' })}
              />
            )}
          </div>
        );
      },
    },
    { accessorKey: 'unit', header: t('common.unit'), size: 60, meta: { filterType: 'text' as const } },
  ], [t, availableStocksByItem, selectedMatUids, isLoadingLots, handleLotChange, handleQtyChange]);

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

        {/* 공정 지정 출고 안내 (공정재고 적재) */}
        {detail?.processCode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 text-primary text-sm">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              {t('material.issue.processStockNotice', {
                defaultValue: '공정 {{code}}의 공정재고(장착 대기)로 적재됩니다.',
                code: detail.processCode,
              })}
            </span>
          </div>
        )}

        {/* 출고계정 선택 */}
        <div className="w-64">
          <Select
            label={t('material.issueAccount')}
            options={issueTypeOptions}
            value={issueType}
            onChange={setIssueType}
            required
            fullWidth
          />
        </div>

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
              disabled={totalIssueQty <= 0 || isLoadingLots}
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
