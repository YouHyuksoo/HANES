"use client";

/**
 * @file src/components/material/WorkOrderRequestPanel.tsx
 * @description 출고요청 패널 - 좌측 작업지시 목록(master) + 우측 탭(출고요청 내역 / 신규 요청)
 *
 * 초보자 가이드:
 * 1. **좌측(master)**: 작업지시를 작업지시번호·모델·상태로 조회·선택한다.
 * 2. **우측 탭 고정**: [출고요청 내역] / [신규 요청] 두 탭이 항상 보여서 지금 어느 화면인지 알 수 있다.
 *    - 내역 탭: 선택한 작업지시의 요청건을 인라인 접기/펼치기로 본다(상세 모달을 띄우지 않는다).
 *    - 신규 요청 탭: BOM 기준 출고 예정 원자재 그리드에서 수량을 입력하고 등록한다.
 * 3. **미선택 시**: 탭은 비활성이고, 우측에는 최근 출고요청 전체 목록이 보인다.
 *    이 목록은 인라인 상세가 없어서 행 클릭 시 상세 모달을 띄운다(유일한 상세 확인 수단).
 */
import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ClipboardList, AlertTriangle, Loader2, Plus, PackageCheck, X, Info } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, ComCodeBadge } from '@/components/ui';
import ComCodeSelect from '@/components/shared/ComCodeSelect';
import { api } from '@/services/api';
import { notifyIssueWarnings } from '@/components/material/issue-warnings';
import { useInvalidateQueries } from '@/hooks/useApi';
import RequestTable from '@/components/material/RequestTable';
import JobOrderTreeList, { type JobOrderListRow } from '@/components/material/issue-request/JobOrderTreeList';
import IssueRequestHistoryPanel from '@/components/material/issue-request/IssueRequestHistoryPanel';
import IssueRequestCreatePanel from '@/components/material/issue-request/IssueRequestCreatePanel';
import type { BomRequestResult, BomRequestSummary, IssueRequest, RequestItem, StockItem } from '@/hooks/material/useIssueRequestData';

type RightTab = 'history' | 'create';

interface WorkOrderRequestPanelProps {
  jobOrders: JobOrderListRow[];
  isLoadingJobOrders?: boolean;
  loadBomRequestItems: (orderNo: string) => Promise<BomRequestResult>;
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
  woItemType: string;
  onWoItemTypeChange: (v: string) => void;
  /** 최근 출고요청 조회 필터 */
  requestSearchText: string;
  onRequestSearchTextChange: (v: string) => void;
  requestStatusFilter: string;
  onRequestStatusFilterChange: (v: string) => void;
  /** 미선택 시 우측에 표시할 최근 출고요청 목록 */
  recentRequests: IssueRequest[];
  isLoadingRequests?: boolean;
  onViewRequestDetail?: (request: IssueRequest) => void;
}

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
  woItemType,
  onWoItemTypeChange,
  requestSearchText,
  onRequestSearchTextChange,
  requestStatusFilter,
  onRequestStatusFilterChange,
  recentRequests,
  isLoadingRequests,
  onViewRequestDetail,
}: WorkOrderRequestPanelProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();

  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  const [selectedProcessCode, setSelectedProcessCode] = useState('');
  const [activeTab, setActiveTab] = useState<RightTab>('history');
  // 내역(history) 상태
  const [woRequests, setWoRequests] = useState<IssueRequest[]>([]);
  const [isLoadingWoRequests, setIsLoadingWoRequests] = useState(false);
  // 신규 요청(create) 상태
  const [detailItems, setDetailItems] = useState<RequestItem[]>([]);
  const [bomSummary, setBomSummary] = useState<BomRequestSummary | null>(null);
  // BOM 산출 자체가 실패한 경우. 빈 목록 안내("BOM이 없습니다")와 구분해야 오해가 없다.
  const [bomLoadFailed, setBomLoadFailed] = useState(false);
  // BOM 외 품목 직접추가 검색
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState<StockItem[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [reason, setReason] = useState('생산투입');
  const [isLoadingBom, setIsLoadingBom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const resetCreateState = useCallback(() => {
    setErrorMessage('');
    setDetailItems([]);
    setBomSummary(null);
    setBomLoadFailed(false);
    setManualQuery('');
    setManualResults([]);
    setSelectedProcessCode('');
  }, []);

  const reasonOptions = [
    { value: '생산투입', label: t('material.request.reasonProduction') },
    { value: '시작품', label: t('material.request.reasonPrototype') },
    { value: '샘플', label: t('material.request.reasonSample') },
    { value: '기타', label: t('material.request.reasonOther') },
  ];

  const itemTypeFilterOptions = [
    { value: '', label: t('common.all') },
    { value: 'FINISHED', label: t('production.order.itemTypeFG', '완제품') },
    { value: 'SEMI_PRODUCT', label: t('production.order.itemTypeWIP', '반제품') },
  ];

  const requestStatusFilterOptions = [
    { value: '', label: t('common.all') },
    { value: 'REQUESTED', label: t('material.request.status.requested', '대기') },
    { value: 'APPROVED', label: t('material.request.status.approved', '승인') },
    { value: 'PARTIAL', label: t('material.request.status.partial', '부분출고') },
    { value: 'COMPLETED', label: t('material.request.status.completed', '완료') },
    { value: 'REJECTED', label: t('material.request.status.rejected', '반려') },
  ];

  const selectedOrder = useMemo(
    () => jobOrders.find((j) => j.orderNo === selectedOrderNo) ?? null,
    [jobOrders, selectedOrderNo],
  );

  const hasFilter = !!(woOrderNo || woModel || woStatus || woItemType);
  const clearFilters = () => {
    onWoOrderNoChange('');
    onWoModelChange('');
    onWoStatusChange('WAITING');
    onWoItemTypeChange('');
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

  const handleSelectOrder = useCallback((order: JobOrderListRow) => {
    setSelectedOrderNo(order.orderNo);
    setActiveTab('history');
    resetCreateState();
    loadHistory(order.orderNo);
  }, [loadHistory, resetCreateState]);

  // 신규 요청 탭 진입 - BOM 기준 출고 예정 품목 계산
  const enterCreateTab = useCallback(async () => {
    if (!selectedOrderNo) return;
    setActiveTab('create');
    resetCreateState();
    // 출고 공정 기본값 = 작업지시 대표 공정(라우팅 첫 SEQ 상속). 생산 출고는 공정재고 적재가 필수라 필수 입력이다.
    setSelectedProcessCode(selectedOrder?.processCode ?? '');
    setIsLoadingBom(true);
    try {
      const result = await loadBomRequestItems(selectedOrderNo);
      setDetailItems(result.items);
      setBomSummary(result.summary);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || t('material.request.bomLoadError');
      setErrorMessage(message);
      setBomLoadFailed(true);
    } finally {
      setIsLoadingBom(false);
    }
  }, [selectedOrderNo, selectedOrder, loadBomRequestItems, resetCreateState, t]);

  const handleTabChange = useCallback((tab: RightTab) => {
    if (tab === activeTab) return;
    if (tab === 'history') {
      setActiveTab('history');
      resetCreateState();
      return;
    }
    enterCreateTab();
  }, [activeTab, enterCreateTab, resetCreateState]);

  const updateQty = useCallback((itemCode: string, qty: number) => {
    setDetailItems((prev) =>
      prev.map((r) => (r.itemCode === itemCode ? { ...r, requestQty: qty } : r)),
    );
  }, []);

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

  const addManualItem = useCallback((item: StockItem) => {
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
  }, []);

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
      const res = await api.post('/material/issue-requests', body);
      // IQC 미검사 재고만 있는 품목 안내(생성은 차단하지 않음)
      notifyIssueWarnings(res.data);
      invalidate(['issue-request-data']);
      invalidate(['issue-requests']);
      resetCreateState();
      setActiveTab('history');
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
    && !!selectedProcessCode
    && detailItems.some((r) => r.requestQty > 0)
    && !isSubmitting
    && !isLoadingBom;

  const tabs: Array<{ key: RightTab; label: string }> = [
    { key: 'history', label: t('material.request.tabHistory') },
    { key: 'create', label: t('material.request.tabCreate') },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* 조건 필터 바 (한 줄, 넓게) */}
      <Card padding="none" className="flex-shrink-0">
        <div className="p-3 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Input
              data-testid="mat-request-order-search"
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
          <div className="w-40 flex-shrink-0">
            <Select
              options={itemTypeFilterOptions}
              value={woItemType}
              onChange={onWoItemTypeChange}
              placeholder={t('common.itemType', '품목유형')}
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
        <Card className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden" padding="none">
          <JobOrderTreeList
            jobOrders={jobOrders}
            isLoading={isLoadingJobOrders}
            selectedOrderNo={selectedOrderNo}
            onSelect={handleSelectOrder}
          />
        </Card>

        {/* 우측: 탭 고정 (내역 / 신규 요청) */}
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden" padding="none">
          {/* 작업지시 요약 + 탭 + 등록 버튼을 한 줄에 둔다 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 pt-2">
            {selectedOrder ? (
              <div className="flex min-w-0 items-center gap-2 pb-2">
                <span className="font-mono text-sm font-semibold text-primary">{selectedOrder.orderNo}</span>
                <ComCodeBadge
                  groupCode="JOB_ORDER_STATUS"
                  code={String(selectedOrder.status)}
                  className="shrink-0 whitespace-nowrap"
                />
                <span className="truncate text-sm text-text">
                  {selectedOrder.part?.itemName ?? selectedOrder.itemCode}
                </span>
                {selectedOrder.part?.itemName && selectedOrder.part.itemName !== selectedOrder.itemCode && (
                  <span className="shrink-0 font-mono text-xs text-text-muted">{selectedOrder.itemCode}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 pb-2 text-sm text-text-muted">
                <Info className="w-4 h-4 shrink-0" />
                <span>{t('material.request.selectOrderNotice')}</span>
              </div>
            )}

            {/* 탭 - 작업지시 미선택이면 비활성으로 보이되 자리는 유지한다 */}
            <div className="flex items-end gap-1">
              {tabs.map((tab) => {
                const isActive = !!selectedOrder && activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    disabled={!selectedOrder}
                    data-testid={tab.key === 'create' ? 'mat-request-new' : 'mat-request-history-tab'}
                    onClick={() => handleTabChange(tab.key)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-muted hover:text-text'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {selectedOrder && activeTab === 'create' && (
              <div className="ml-auto pb-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  data-testid="mat-request-submit"
                  disabledReason={isSubmitting ? t('material.disabledHelp.requestSaving', '출고요청을 저장하고 있습니다.') : isLoadingBom ? t('material.disabledHelp.bomLoading', '작업지시의 BOM 품목을 불러오고 있습니다.') : !selectedOrderNo ? t('material.disabledHelp.selectOrder', '작업지시를 선택하세요.') : !selectedProcessCode ? t('material.disabledHelp.selectProcess', '출고 대상 공정을 선택하세요.') : t('material.disabledHelp.positiveRequest', '요청수량이 0보다 큰 품목을 한 건 이상 입력하세요.')}
                >
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

          {!selectedOrder ? (
            /* 미선택: 최근 출고요청 전체 목록 (행 클릭 시 상세 모달 - 여기는 인라인 상세가 없어 모달이 유일한 수단) */
            <CardContent className="flex-1 min-h-0 p-4 flex flex-col">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-primary" />
                  {t('material.request.recentRequestsTitle')}
                </h2>
                <div className="flex items-center gap-2">
                  <div className="w-72">
                    <Input
                      value={requestSearchText}
                      onChange={(e) => onRequestSearchTextChange(e.target.value)}
                      placeholder={t('material.request.searchRequestPlaceholder', '요청번호 / 품목 / 비고 검색')}
                      fullWidth
                    />
                  </div>
                  <div className="w-32">
                    <Select
                      options={requestStatusFilterOptions}
                      value={requestStatusFilter}
                      onChange={onRequestStatusFilterChange}
                      fullWidth
                    />
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <RequestTable
                  data={recentRequests}
                  isLoading={isLoadingRequests}
                  onViewDetail={onViewRequestDetail}
                />
              </div>
            </CardContent>
          ) : activeTab === 'history' ? (
            <IssueRequestHistoryPanel
              requests={woRequests}
              isLoading={isLoadingWoRequests}
              onCreateRequest={enterCreateTab}
            />
          ) : (
            <IssueRequestCreatePanel
              items={detailItems}
              summary={bomSummary}
              loadFailed={bomLoadFailed}
              isLoadingBom={isLoadingBom}
              processCode={selectedProcessCode}
              onProcessCodeChange={setSelectedProcessCode}
              reason={reason}
              onReasonChange={setReason}
              reasonOptions={reasonOptions}
              manualQuery={manualQuery}
              onManualQueryChange={setManualQuery}
              manualResults={manualResults}
              isSearchingManual={isSearchingManual}
              onManualSearch={handleManualSearch}
              onAddManualItem={addManualItem}
              onQtyChange={updateQty}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
