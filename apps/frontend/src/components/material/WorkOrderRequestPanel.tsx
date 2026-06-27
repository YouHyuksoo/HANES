"use client";

/**
 * @file src/components/material/WorkOrderRequestPanel.tsx
 * @description 출고요청 패널 - 좌측 작업지시 목록, 우측 작업지시별 출고요청 내역(그룹 상세) / 신규 작성
 *
 * 초보자 가이드:
 * 1. **좌측(master)**: 작업지시를 작업지시번호·모델·상태로 조회·선택
 * 2. **우측 내역(detail)**: 선택한 작업지시의 기존 출고요청을 요청건별로 그룹지어 품목 상세까지 표시
 * 3. **신규 작성**: [신규 작성] 전환 시 BOM 기준 출고 예정 원자재 그리드에서 수량 입력 후 등록
 * 4. **미선택 시**: 우측에 최근 출고요청 목록을 표시
 */
import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ClipboardList, AlertTriangle, Loader2, Plus, PackageCheck, X, ListChecks, FilePlus2, ChevronLeft, Info } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, ComCodeBadge } from '@/components/ui';
import ComCodeSelect from '@/components/shared/ComCodeSelect';
import ProcessSelect from '@/components/shared/ProcessSelect';
import { IssueRequestStatusBadge, type IssueRequestStatus } from '@/components/material';
import { api } from '@/services/api';
import { useInvalidateQueries } from '@/hooks/useApi';
import RequestTable from '@/components/material/RequestTable';
import type { ProductionJobOrderRow } from '@harness/shared';
import type { IssueRequest, RequestItem, StockItem } from '@/hooks/material/useIssueRequestData';

type RightMode = 'history' | 'create';

interface WorkOrderRequestPanelProps {
  jobOrders: ProductionJobOrderRow[];
  isLoadingJobOrders?: boolean;
  loadBomRequestItems: (orderNo: string) => Promise<RequestItem[]>;
  loadRequestsByOrder: (orderNo: string) => Promise<IssueRequest[]>;
  /** BOM 외 품목 직접추가용 검색 */
  searchStockItems: (query: string) => Promise<StockItem[]>;
  /** 작업지시 조회 필터 (서버 사이드) */
  woOrderNo: string;
  onWoOrderNoChange: (v: string) => void;
  woModel: string;
  onWoModelChange: (v: string) => void;
  woStatus: string;
  onWoStatusChange: (v: string) => void;
  /** 미선택 시 우측에 표시할 최근 출고요청 목록 */
  recentRequests: IssueRequest[];
  isLoadingRequests?: boolean;
  onViewRequestDetail?: (request: IssueRequest) => void;
}

const toNum = (v: number | null | undefined) => Number(v ?? 0);

/** 실출고수량 = ceil(요청/포장단위)*포장단위. 포장단위<=0이면 요청 그대로 */
const calcIssueQty = (requestQty: number, minPackQty: number) =>
  minPackQty > 0 && requestQty > 0 ? Math.ceil(requestQty / minPackQty) * minPackQty : requestQty;

export default function WorkOrderRequestPanel({
  jobOrders,
  isLoadingJobOrders,
  loadBomRequestItems,
  loadRequestsByOrder,
  searchStockItems,
  woOrderNo,
  onWoOrderNoChange,
  woModel,
  onWoModelChange,
  woStatus,
  onWoStatusChange,
  recentRequests,
  isLoadingRequests,
  onViewRequestDetail,
}: WorkOrderRequestPanelProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();

  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  const [selectedProcessCode, setSelectedProcessCode] = useState('');
  const [mode, setMode] = useState<RightMode>('history');
  // 내역(history) 상태
  const [woRequests, setWoRequests] = useState<IssueRequest[]>([]);
  const [isLoadingWoRequests, setIsLoadingWoRequests] = useState(false);
  // 신규 작성(create) 상태
  const [detailItems, setDetailItems] = useState<RequestItem[]>([]);
  // BOM 외 품목 직접추가 검색
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState<StockItem[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [reason, setReason] = useState('생산투입');
  const [isLoadingBom, setIsLoadingBom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const reasonOptions = [
    { value: '생산투입', label: t('material.request.reasonProduction') },
    { value: '시작품', label: t('material.request.reasonPrototype') },
    { value: '샘플', label: t('material.request.reasonSample') },
    { value: '기타', label: t('material.request.reasonOther') },
  ];

  const selectedOrder = useMemo(
    () => jobOrders.find((j) => j.orderNo === selectedOrderNo) ?? null,
    [jobOrders, selectedOrderNo],
  );

  const hasFilter = !!(woOrderNo || woModel || woStatus);
  const clearFilters = () => {
    onWoOrderNoChange('');
    onWoModelChange('');
    onWoStatusChange('');
  };

  // 선택 작업지시의 기존 출고요청 내역 로드
  const loadHistory = useCallback(async (orderNo: string) => {
    setIsLoadingWoRequests(true);
    try {
      setWoRequests(await loadRequestsByOrder(orderNo));
    } catch {
      setWoRequests([]);
    } finally {
      setIsLoadingWoRequests(false);
    }
  }, [loadRequestsByOrder]);

  const handleSelectOrder = useCallback((order: ProductionJobOrderRow) => {
    setSelectedOrderNo(order.orderNo);
    setMode('history');
    setErrorMessage('');
    setDetailItems([]);
    loadHistory(order.orderNo);
  }, [loadHistory]);

  // 신규 작성 모드 진입 - BOM 기준 출고 예정 품목 계산
  const enterCreateMode = useCallback(async () => {
    if (!selectedOrderNo) return;
    setMode('create');
    setErrorMessage('');
    setDetailItems([]);
    setIsLoadingBom(true);
    try {
      const items = await loadBomRequestItems(selectedOrderNo);
      setDetailItems(items);
      if (items.length === 0) setErrorMessage(t('material.request.noBomItems'));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || t('material.request.bomLoadError');
      setErrorMessage(message);
    } finally {
      setIsLoadingBom(false);
    }
  }, [selectedOrderNo, loadBomRequestItems, t]);

  const updateQty = (itemCode: string, qty: number) => {
    setDetailItems((prev) =>
      prev.map((r) => (r.itemCode === itemCode ? { ...r, requestQty: qty } : r)),
    );
  };

  // BOM 외 품목 직접 추가 (작업지시 BOM에 없는 자재를 현장 판단으로 추가)
  const handleManualSearch = useCallback(async () => {
    if (!manualQuery.trim()) return;
    setIsSearchingManual(true);
    try {
      setManualResults(await searchStockItems(manualQuery));
    } catch {
      setManualResults([]);
    } finally {
      setIsSearchingManual(false);
    }
  }, [manualQuery, searchStockItems]);

  const addManualItem = (item: StockItem) => {
    setDetailItems((prev) => {
      if (prev.some((r) => r.itemCode === item.itemCode)) return prev;
      return [
        ...prev,
        {
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit,
          currentStock: item.currentStock,
          requestQty: 0,
          minPackQty: item.minPackQty ?? 0,
        },
      ];
    });
  };

  const handleSubmit = async () => {
    if (!selectedOrderNo) return;
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const body = {
        orderNo: selectedOrderNo,
        processCode: selectedProcessCode || undefined,
        items: detailItems
          .filter((item) => item.requestQty > 0)
          .map((item) => ({
            itemCode: item.itemCode,
            requestQty: item.requestQty,
            unit: item.unit,
            bomReqQty: item.bomReqQty,
            prevIssueQty: item.prevIssueQty,
            floorStockQty: item.floorStockQty,
          })),
        remark: reason || undefined,
      };
      await api.post('/material/issue-requests', body);
      invalidate(['issue-request-data']);
      invalidate(['issue-requests']);
      // 등록 후 내역 모드로 복귀 + 해당 작업지시 내역 갱신
      setDetailItems([]);
      setMode('history');
      await loadHistory(selectedOrderNo);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || t('common.errorOccurred', { defaultValue: '요청 처리 중 오류가 발생했습니다.' });
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !!selectedOrderNo
    && detailItems.some((r) => r.requestQty > 0)
    && !isSubmitting
    && !isLoadingBom;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* 조건 필터 바 (한 줄, 넓게) */}
      <Card padding="none" className="flex-shrink-0">
        <div className="p-3 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Input
              placeholder={t('material.request.filterOrderNo')}
              value={woOrderNo}
              onChange={(e) => onWoOrderNoChange(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
          <div className="flex-1 min-w-0">
            <Input
              placeholder={t('material.request.filterModel')}
              value={woModel}
              onChange={(e) => onWoModelChange(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
          <div className="w-48 flex-shrink-0">
            <ComCodeSelect
              groupCode="JOB_ORDER_STATUS"
              labelPrefix={t('common.status')}
              value={woStatus}
              onChange={onWoStatusChange}
              fullWidth
            />
          </div>
          {hasFilter && (
            <Button variant="secondary" size="sm" onClick={clearFilters} className="flex-shrink-0">
              <X className="w-4 h-4 mr-1" /> {t('common.reset')}
            </Button>
          )}
        </div>
      </Card>

      {/* master-detail */}
      <div className="flex-1 min-h-0 flex gap-4">
      {/* 좌측: 작업지시 목록 (master) */}
      <Card className="w-[360px] flex-shrink-0 flex flex-col overflow-hidden" padding="none">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
            {t('material.request.workOrderListTitle')}
            <span className="text-xs font-normal text-text-muted">({jobOrders.length})</span>
          </h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoadingJobOrders ? (
            <div className="flex items-center justify-center h-32 text-text-muted text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
            </div>
          ) : jobOrders.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-muted text-sm">
              {t('material.request.noWorkOrder')}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {jobOrders.map((order) => {
                const active = order.orderNo === selectedOrderNo;
                return (
                  <li key={order.orderNo}>
                    <button
                      type="button"
                      onClick={() => handleSelectOrder(order)}
                      className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
                        active
                          ? 'border-l-primary bg-primary/5'
                          : 'border-l-transparent hover:bg-card-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-mono text-xs font-semibold ${active ? 'text-primary' : 'text-text'}`}>
                          {order.orderNo}
                        </span>
                        <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={String(order.status)} />
                      </div>
                      <div className="mt-1 text-sm text-text truncate">
                        {order.part?.itemName ?? order.itemCode}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-xs text-text-muted">
                        <span className="font-mono">{order.itemCode}</span>
                        <span>
                          {t('material.request.planQtyShort')} {toNum(order.planQty).toLocaleString()}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* 우측: 선택한 작업지시의 BOM 상세 (detail) */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden" padding="none">
        {!selectedOrder ? (
          /* 미선택: 최근 출고요청 목록 */
          <CardContent className="h-full p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-primary" />
              {t('material.request.recentRequestsTitle')}
            </h2>
            <div className="flex-1 min-h-0">
              <RequestTable
                data={recentRequests}
                isLoading={isLoadingRequests}
                onViewDetail={onViewRequestDetail}
              />
            </div>
          </CardContent>
        ) : (
          <div className="h-full flex flex-col min-h-0">
            {/* 작업지시 헤더 + 모드 전환 */}
            <div className="p-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-primary">{selectedOrder.orderNo}</span>
                  <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={String(selectedOrder.status)} />
                </div>
                <div className="mt-0.5 text-sm text-text truncate">
                  {selectedOrder.part?.itemName ?? selectedOrder.itemCode}
                  <span className="ml-2 text-xs text-text-muted font-mono">{selectedOrder.itemCode}</span>
                </div>
              </div>
              {mode === 'history' ? (
                <Button size="sm" onClick={enterCreateMode}>
                  <FilePlus2 className="w-4 h-4 mr-1" /> {t('material.request.newRequest')}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setMode('history'); setErrorMessage(''); }}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> {t('material.request.backToHistory')}
                  </Button>
                  <div className="w-40">
                    <ProcessSelect value={selectedProcessCode} onChange={setSelectedProcessCode} fullWidth />
                  </div>
                  <div className="w-40">
                    <Select options={reasonOptions} value={reason} onChange={setReason} fullWidth />
                  </div>
                  <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    {t('material.request.registerRequest')}
                  </Button>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="m-3 mb-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {mode === 'create' && selectedProcessCode && (
              <div className="m-3 mb-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 text-primary text-sm">
                <Info className="w-4 h-4 shrink-0" />
                <span>{t('material.request.processStockNotice', { defaultValue: '지정 공정의 공정재고(장착 대기)로 적재됩니다. 미지정 시 자재창고로 출고됩니다.' })}</span>
              </div>
            )}

            {mode === 'history' ? (
              /* 작업지시별 출고요청 내역 (요청건별 그룹 + 품목 상세) */
              <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
                {isLoadingWoRequests ? (
                  <div className="flex items-center justify-center h-32 text-text-muted text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
                  </div>
                ) : woRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-text-muted text-sm gap-2">
                    <ListChecks className="w-8 h-8 opacity-40" />
                    <span>{t('material.request.noRequestForOrder')}</span>
                    <Button size="sm" variant="secondary" onClick={enterCreateMode}>
                      <FilePlus2 className="w-4 h-4 mr-1" /> {t('material.request.newRequest')}
                    </Button>
                  </div>
                ) : (
                  woRequests.map((req) => (
                    <div key={req.requestNo} className="border border-border rounded-lg overflow-hidden">
                      {/* 그룹 헤더: 요청건 */}
                      <button
                        type="button"
                        onClick={() => onViewRequestDetail?.(req)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-background/50 hover:bg-card-hover text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-semibold text-text">{req.requestNo}</span>
                          <IssueRequestStatusBadge status={req.status as IssueRequestStatus} />
                          {req.requestDate && (
                            <span className="text-xs text-text-muted">{req.requestDate}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted shrink-0">
                          <span>{(req.items?.length ?? 0)}{t('material.request.items')}</span>
                          <span className="text-text">
                            {t('material.request.requestQtyLabel')} {toNum(req.totalRequestQty ?? req.totalQty).toLocaleString()}
                          </span>
                          {req.requester && <span>{req.requester}</span>}
                        </div>
                      </button>
                      {/* 그룹 상세: 품목 */}
                      <table className="w-full text-sm">
                        <thead className="bg-background/30 text-text-muted">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium w-8">#</th>
                            <th className="text-left px-3 py-1.5 font-medium">{t('common.partCode')}</th>
                            <th className="text-left px-3 py-1.5 font-medium">{t('common.partName')}</th>
                            <th className="text-center px-3 py-1.5 font-medium w-16">{t('common.unit')}</th>
                            <th className="text-right px-3 py-1.5 font-medium w-24">{t('material.request.requestQtyLabel')}</th>
                            <th className="text-right px-3 py-1.5 font-medium w-24">{t('material.issue.issuedLabel')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(req.items ?? []).map((item, idx) => (
                            <tr key={`${req.requestNo}-${item.itemCode}-${idx}`} className="border-t border-border">
                              <td className="px-3 py-1.5 text-text-muted">{idx + 1}</td>
                              <td className="px-3 py-1.5 font-mono text-xs">{item.itemCode}</td>
                              <td className="px-3 py-1.5">{item.itemName}</td>
                              <td className="px-3 py-1.5 text-center text-text-muted">{item.unit}</td>
                              <td className="px-3 py-1.5 text-right font-medium">{toNum(item.requestQty).toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right text-text-muted">{toNum(item.issuedQty).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* 신규 작성: BOM 상세 그리드 + 품목 직접추가 */
              <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
                {/* BOM 외 품목 직접추가 */}
                <div className="flex gap-2">
                  <Input
                    placeholder={t('material.request.searchPartPlaceholder')}
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleManualSearch(); }}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                  <Button size="sm" variant="secondary" onClick={handleManualSearch} disabled={isSearchingManual}>
                    {isSearchingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.search')}
                  </Button>
                </div>
                {manualResults.length > 0 && (
                  <div className="border border-border rounded-lg max-h-32 overflow-auto">
                    {manualResults.map((item) => {
                      const added = detailItems.some((r) => r.itemCode === item.itemCode);
                      return (
                        <div key={item.itemCode} className="flex items-center gap-2 px-3 py-1.5 text-sm border-t border-border first:border-t-0">
                          <span className="font-mono text-xs">{item.itemCode}</span>
                          <span className="flex-1 truncate">{item.itemName}</span>
                          <button
                            onClick={() => addManualItem(item)}
                            disabled={added}
                            className={`p-1 rounded ${added ? 'text-text-muted opacity-50' : 'text-primary hover:bg-primary/10'}`}
                            title={added ? t('material.request.alreadyAdded') : t('material.request.addToRequest')}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isLoadingBom ? (
                  <div className="flex items-center justify-center h-32 text-primary text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('material.request.bomCalculating')}
                  </div>
                ) : detailItems.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                    {t('material.request.noBomItems')}
                  </div>
                ) : (
                  <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                    <thead className="bg-background/50 sticky top-0">
                      <tr className="text-text-muted">
                        <th className="text-left px-3 py-2 font-medium w-10">#</th>
                        <th className="text-left px-3 py-2 font-medium">{t('common.partCode')}</th>
                        <th className="text-left px-3 py-2 font-medium">{t('common.partName')}</th>
                        <th className="text-center px-3 py-2 font-medium w-16">{t('common.unit')}</th>
                        <th className="text-right px-3 py-2 font-medium w-24">{t('material.request.bomReqQty')}</th>
                        <th className="text-right px-3 py-2 font-medium w-24">{t('material.request.prevIssueQty')}</th>
                        <th className="text-right px-3 py-2 font-medium w-24">{t('material.request.floorStockQty')}</th>
                        <th className="text-right px-3 py-2 font-medium w-24">{t('material.request.currentStock')}</th>
                        <th className="text-center px-3 py-2 font-medium w-32">{t('material.request.requestQtyLabel')}</th>
                        <th className="text-right px-3 py-2 font-medium w-20">{t('material.request.minPackQty', { defaultValue: '포장단위' })}</th>
                        <th className="text-right px-3 py-2 font-medium w-24">{t('material.request.issueQtyLabel', { defaultValue: '실출고수량' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.map((item, idx) => {
                        const overStock = item.requestQty > toNum(item.currentStock);
                        const minPackQty = toNum(item.minPackQty);
                        const issueQty = calcIssueQty(toNum(item.requestQty), minPackQty);
                        return (
                          <tr key={item.itemCode} className="border-t border-border hover:bg-card-hover">
                            <td className="px-3 py-2 text-text-muted">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs">{item.itemCode}</td>
                            <td className="px-3 py-2">{item.itemName}</td>
                            <td className="px-3 py-2 text-center text-text-muted">{item.unit}</td>
                            <td className="px-3 py-2 text-right">{toNum(item.bomReqQty).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-text-muted">{toNum(item.prevIssueQty).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-text-muted">{toNum(item.floorStockQty).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right font-medium ${overStock ? 'text-red-500' : ''}`}>
                              {toNum(item.currentStock).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.requestQty || ''}
                                  onChange={(e) => updateQty(item.itemCode, Number(e.target.value))}
                                  className={`w-full px-2 py-1 text-sm border rounded text-right bg-surface text-text ${
                                    overStock ? 'border-red-400' : 'border-border'
                                  }`}
                                  placeholder="0"
                                />
                                {overStock && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-text-muted">
                              {minPackQty > 0 ? minPackQty.toLocaleString() : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-primary">
                              {issueQty.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
