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
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Package, AlertTriangle, Info, Scissors, Printer } from 'lucide-react';
import { isProductionIssueType, allocateFifo, roundUpToPack, type FifoLot } from '@harness/shared';
import { Modal, Button, Select } from '@/components/ui';
import ProcessSelect from '@/components/shared/ProcessSelect';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';
import { useComCodeOptions } from '@/hooks/useComCode';
import { notifyIssueWarnings } from '@/components/material/issue-warnings';
import RequestItemList from './issue-from-request/RequestItemList';
import LotAllocationPanel from './issue-from-request/LotAllocationPanel';
import SplitLabelSequence, { type SplitGroup } from './issue-from-request/SplitLabelSequence';
import type { AllocationMap, AvailableStock, IssueRow, RequestDetailItem } from './issue-from-request/types';
import { stockAvailableQty, sumSlices } from './issue-from-request/types';

interface IssueFromRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
}

/** 요청 상세 응답 */
interface RequestDetail {
  id: string;
  requestNo: string;
  orderNo?: string | null;
  requester: string;
  status: string;
  issueType?: string;
  /** 요청에 지정된 출고 공정 */
  processCode?: string | null;
  /** 출고 시 적용될 공정(요청 공정 → 작업지시 공정 → 라우팅 첫 공정). 백엔드가 계산 */
  issueProcessCode?: string | null;
  items: RequestDetailItem[];
}

export default function IssueFromRequestModal({
  isOpen, onClose, requestId,
}: IssueFromRequestModalProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();
  const issueTypeOptions = useComCodeOptions('ISSUE_TYPE');
  const [issueType, setIssueType] = useState<string>('PRODUCTION');
  const [processCode, setProcessCode] = useState<string>('');
  const [issueRows, setIssueRows] = useState<IssueRow[]>([]);
  const [availableStocksByItem, setAvailableStocksByItem] = useState<Record<string, AvailableStock[]>>({});
  const [allocation, setAllocation] = useState<AllocationMap>({});
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  /** 사용자가 직접 수량을 고친 품목 — 자동배분이 덮어쓰지 않는다 */
  const [manualRowKeys, setManualRowKeys] = useState<Set<string>>(new Set());
  /**
   * manualRowKeys 를 async 콜백(loadAvailableLots) 안에서 읽기 위한 ref.
   * effect 의 deps 에 manualRowKeys 를 넣지 않는 이상 클로저가 effect 실행 시점의
   * 값을 캡처하므로, LOT 조회가 진행되는 동안 사용자가 수동 배분을 하면
   * 응답 도착 시 그 캡처된(오래된) Set 기준으로 덮어써버린다.
   * ref 는 항상 최신값을 들고 있어 "쓰는 시점"에 최신 manualRowKeys 를 읽게 한다.
   */
  const manualRowKeysRef = useRef(manualRowKeys);
  useEffect(() => {
    manualRowKeysRef.current = manualRowKeys;
  }, [manualRowKeys]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** 부분 사용 롯트를 출고분/잔량분으로 분할한 결과 — 라벨 재출력에 대비해 보관한다 */
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([]);
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  /** 언마운트 후 비동기 응답이 setState 하지 않도록 방지 */
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  /**
   * reloadLots 는 최초 진입 effect 와 handleSplit 양쪽에서 겹쳐 호출될 수 있다
   * (예: 조회 응답을 기다리는 동안 상세 refetch 로 issueRows 참조가 바뀌어 effect 가
   * 다시 돈다). isMountedRef 는 "언마운트"만 막을 뿐 "더 오래된 응답이 나중에 도착"하는
   * 건 못 막으므로, 호출마다 증가하는 실행 토큰으로 최신 호출만 반영한다.
   */
  const lotsRunRef = useRef(0);

  /** 한 품목을 FIFO 자동배분한다 */
  const allocateRow = useCallback((row: IssueRow, stocks: AvailableStock[]) => {
    const fifoLots: FifoLot[] = stocks.map((stock) => ({
      matUid: stock.matUid,
      availableQty: stockAvailableQty(stock),
    }));
    return allocateFifo(row.packRemainQty, fifoLots).slices;
  }, []);

  /** 롯트별 배분수량 수동 변경. 다른 롯트 배분을 합쳐도 packRemainQty(실출고수량)를 넘지 못한다 */
  const handleSliceChange = useCallback((rowKey: string, matUid: string, qty: number) => {
    setManualRowKeys((prev) => new Set(prev).add(rowKey));
    setAllocation((prev) => {
      const others = (prev[rowKey] ?? []).filter((slice) => slice.matUid !== matUid);
      const row = issueRows.find((r) => r.rowKey === rowKey);
      const room = Math.max(0, (row?.packRemainQty ?? 0) - sumSlices(others));
      const cappedQty = Math.min(qty, room);
      const next = cappedQty > 0 ? [...others, { matUid, qty: cappedQty }] : others;
      return { ...prev, [rowKey]: next };
    });
  }, [issueRows]);

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
        };
      }),
    );
    // 요청에 issueType이 있으면 기본값 설정
    if (detail.issueType) {
      setIssueType(detail.issueType);
    }
    // 출고 공정 기본값: 요청 공정 → 작업지시 공정 → 라우팅 첫 공정(백엔드 계산값)
    setProcessCode(detail.processCode ?? detail.issueProcessCode ?? '');
  }, [detail]);

  const isProductionIssue = isProductionIssueType(issueType);
  const processMissing = isProductionIssue && !processCode;

  /**
   * 품목별 출고 가능 LOT 을 다시 읽는다. 최초 진입 시의 useEffect 뿐 아니라
   * 분할(handleSplit) 성공 후에도 신규 시리얼을 반영하려면 다시 호출해야 한다.
   */
  const reloadLots = useCallback(async () => {
    if (issueRows.length === 0) return;
    const runId = ++lotsRunRef.current;
    const isStale = () => !isMountedRef.current || runId !== lotsRunRef.current;
    const itemCodes = [...new Set(issueRows.map((row) => row.itemCode).filter(Boolean))];
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
      if (isStale()) return;
      const nextByItem = Object.fromEntries(entries);
      setAvailableStocksByItem(nextByItem);
      setAllocation((prev) => {
        const next = { ...prev };
        for (const row of issueRows) {
          if (manualRowKeysRef.current.has(row.rowKey)) continue;
          next[row.rowKey] = allocateRow(row, nextByItem[row.itemCode] ?? []);
        }
        return next;
      });
      setSelectedRowKey((prev) => prev ?? issueRows[0]?.rowKey ?? null);
    } catch (err: unknown) {
      if (isStale()) return;
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(axiosErr.response?.data?.message || '출고 가능 LOT 조회에 실패했습니다.');
    } finally {
      if (!isStale()) setIsLoadingLots(false);
    }
  }, [issueRows, allocateRow]);

  useEffect(() => {
    if (!isOpen) return;
    void reloadLots();
  }, [isOpen, reloadLots]);

  // 선택된 요청 품목
  const selectedRow = useMemo(
    () => issueRows.find((row) => row.rowKey === selectedRowKey) ?? null,
    [issueRows, selectedRowKey],
  );

  // 총 출고수량(배분 합계)
  const totalIssueQty = useMemo(
    () => issueRows.reduce((sum, row) => sum + sumSlices(allocation[row.rowKey]), 0),
    [issueRows, allocation],
  );

  /** 부분 사용 롯트만 분할 대상이다 — 전량 사용 롯트는 그대로 출고한다 */
  const splitTargets = useMemo(() => {
    const targets: Array<{ sourceMatUid: string; issueQty: number }> = [];
    for (const row of issueRows) {
      const stocks = availableStocksByItem[row.itemCode] ?? [];
      for (const slice of allocation[row.rowKey] ?? []) {
        const stock = stocks.find((s) => s.matUid === slice.matUid);
        if (!stock) continue;
        const available = stockAvailableQty(stock);
        if (slice.qty > 0 && slice.qty < available) {
          targets.push({ sourceMatUid: slice.matUid, issueQty: slice.qty });
        }
      }
    }
    return targets;
  }, [issueRows, allocation, availableStocksByItem]);

  // 일괄 출고 처리
  const handleSubmit = useCallback(async () => {
    const items = issueRows.flatMap((row) =>
      (allocation[row.rowKey] ?? [])
        .filter((slice) => slice.qty > 0)
        .map((slice) => ({
          requestItemId: String(row.seq),
          matUid: slice.matUid,
          issueQty: slice.qty,
        })),
    );
    if (items.length === 0) return;
    // 생산 출고는 공정재고 적재가 필수(백엔드도 차단)
    if (processMissing) {
      setErrorMsg(t('material.issue.processRequired', { defaultValue: '출고 공정을 선택하세요.' }));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/material/issue-requests/${requestId}/issue`, {
        items,
        issueType,
        processCode: processCode || undefined,
      });
      // 출고 정책 경고(FIFO_ACTION=WARN 등) — 출고는 완료됐으므로 닫되 toast 로 안내(BLOCK 은 400 으로 위 catch)
      notifyIssueWarnings(res.data);
      invalidate(['issue-requests']);
      invalidate(['issue-request-detail']);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(axiosErr.response?.data?.message || '출고 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [issueRows, requestId, issueType, processCode, processMissing, allocation, invalidate, onClose, t]);

  /**
   * 부분 사용 롯트를 출고분/잔량분 신규 시리얼로 분할하고 라벨을 발행한다.
   * 성공 후에는 옛 matUid 를 참조하던 클라이언트 배분 상태를 그대로 재사용하면
   * 백엔드에서 실패하므로(원본 시리얼은 SPLIT 처리되어 재고가 0) 버리고
   * LOT 목록을 다시 읽어 FIFO 자동배분이 새 시리얼 기준으로 다시 돌게 한다.
   */
  const handleSplit = useCallback(async () => {
    if (splitTargets.length === 0) return;
    setIsSplitting(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/material/issue-requests/${requestId}/split-for-issue`, {
        splits: splitTargets,
      });
      const groups = (res.data?.data?.splits ?? []) as SplitGroup[];
      setSplitGroups(groups);
      setIsLabelOpen(true);
      toast.success(t('material.issue.splitNotice', {
        defaultValue: '분할 후 라벨 2장을 출고분과 잔량분에 각각 부착하세요.',
      }));
      // 분할로 생긴 신규 시리얼을 반영한다. 클라이언트 배분 상태는 버리고 다시 계산한다.
      setManualRowKeys(new Set());
      setAllocation({});
      await reloadLots();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(axiosErr.response?.data?.message || 'LOT 분할에 실패했습니다.');
    } finally {
      setIsSplitting(false);
    }
  }, [splitTargets, requestId, reloadLots, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.issue.processAction')} size="full">
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
              <span className="font-medium text-primary">{detail.orderNo ?? '-'}</span>
            </div>
            <div>
              <span className="text-text-muted">{t('material.col.requester')}:</span>{' '}
              <span className="font-medium text-text">{detail.requester}</span>
            </div>
          </div>
        )}

        {/* 출고계정 + 출고 공정 선택 */}
        <div className="flex gap-3">
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
          <div className="w-64">
            <ProcessSelect
              label={t('material.issue.processLabel', { defaultValue: '출고 공정' })}
              value={processCode}
              onChange={setProcessCode}
              required={isProductionIssue}
              error={processMissing ? t('material.issue.processRequired', { defaultValue: '출고 공정을 선택하세요.' }) : undefined}
              fullWidth
            />
          </div>
        </div>

        {/* 공정 지정 출고 안내 (공정재고 적재) */}
        {processCode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 text-primary text-sm">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              {t('material.issue.processStockNotice', {
                defaultValue: '공정 {{code}}의 공정재고(장착 대기)로 적재됩니다.',
                code: processCode,
              })}
            </span>
          </div>
        )}

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* 좌: 요청 내역 / 우: 선택 품목의 FIFO LOT 배분 */}
        <div className="flex gap-3 h-[420px]">
          <div className="w-[45%] min-w-0">
            <RequestItemList
              rows={issueRows}
              allocation={allocation}
              selectedRowKey={selectedRowKey}
              onSelect={setSelectedRowKey}
              isLoading={isLoading}
            />
          </div>
          <div className="flex-1 min-w-0">
            <LotAllocationPanel
              row={selectedRow}
              lots={selectedRow ? (availableStocksByItem[selectedRow.itemCode] ?? []) : []}
              slices={selectedRow ? (allocation[selectedRow.rowKey] ?? []) : []}
              isLoading={isLoadingLots}
              warning={errorMsg}
              onChange={(matUid, qty) => selectedRow && handleSliceChange(selectedRow.rowKey, matUid, qty)}
              onAutoAllocate={() => {
                if (!selectedRow) return;
                setManualRowKeys((prev) => {
                  const next = new Set(prev);
                  next.delete(selectedRow.rowKey);
                  return next;
                });
                setAllocation((prev) => ({
                  ...prev,
                  [selectedRow.rowKey]: allocateRow(selectedRow, availableStocksByItem[selectedRow.itemCode] ?? []),
                }));
              }}
              onReset={() => {
                if (!selectedRow) return;
                setManualRowKeys((prev) => new Set(prev).add(selectedRow.rowKey));
                setAllocation((prev) => ({ ...prev, [selectedRow.rowKey]: [] }));
              }}
            />
          </div>
        </div>

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
            {splitTargets.length > 0 ? (
              <Button onClick={handleSplit} isLoading={isSplitting}>
                <Scissors className="w-4 h-4 mr-1" />
                {t('material.issue.splitAndPrint', { defaultValue: '분할 및 라벨발행' })}
                <span className="ml-1 opacity-70">({splitTargets.length})</span>
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={totalIssueQty <= 0 || isLoadingLots || processMissing} disabledReason={isLoadingLots ? t('material.disabledHelp.lotLoading', '출고 가능한 자재 LOT을 조회하고 있습니다.') : processMissing ? t('material.disabledHelp.selectProcess', '출고 대상 공정을 선택하세요.') : t('material.disabledHelp.selectIssueQty', '출고할 LOT을 선택하고 출고수량을 0보다 크게 입력하세요.')}
                isLoading={isSubmitting}
              >
                <Package className="w-4 h-4 mr-1" />
                {t('material.issue.issueAction')}
              </Button>
            )}
            {splitGroups.length > 0 && (
              <Button variant="secondary" onClick={() => setIsLabelOpen(true)}>
                <Printer className="w-4 h-4 mr-1" />
                {t('material.issue.reprintLabel', { defaultValue: '라벨 재출력' })}
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLabelOpen && (
        <SplitLabelSequence groups={splitGroups} onClose={() => setIsLabelOpen(false)} />
      )}
    </Modal>
  );
}
