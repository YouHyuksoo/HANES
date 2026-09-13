"use client";

/**
 * @file src/components/material/issue-request/IssueRequestCreatePanel.tsx
 * @description 출고요청 화면 [신규 요청] 탭 - BOM 기준 출고 예정 원자재 입력 그리드
 *
 * 초보자 가이드:
 * 1. **입력 줄이 먼저**: 출고 공정과 요청 사유는 본문 최상단 입력 줄에서 고른다(툴바가 아니라 폼이다).
 * 2. **BOM 외 품목**: 검색해서 직접 추가할 수 있다.
 * 3. **실출고수량** = ceil(요청수량 / 불출포장단위) * 불출포장단위. 포장단위가 없으면 요청수량 그대로.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, Loader2, PackageSearch, Plus, Search } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import ProcessSelect from '@/components/shared/ProcessSelect';
import HelpTooltip from '@/components/shared/HelpTooltip';
import QtyInput from '@/components/shared/QtyInput';
import type { BomRequestSummary, RequestItem, StockItem } from '@/hooks/material/useIssueRequestData';

interface SelectOption {
  value: string;
  label: string;
}

interface IssueRequestCreatePanelProps {
  items: RequestItem[];
  /** BOM 산출 단계별 건수. 목록이 비었을 때 원인을 구분해 안내하기 위해 쓴다. */
  summary?: BomRequestSummary | null;
  /** BOM 산출 요청 자체가 실패했는지. true 면 빈 목록 안내 대신 상단 오류 배너만 보여준다. */
  loadFailed?: boolean;
  isLoadingBom?: boolean;
  processCode: string;
  onProcessCodeChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  reasonOptions: SelectOption[];
  manualQuery: string;
  onManualQueryChange: (value: string) => void;
  manualResults: StockItem[];
  isSearchingManual?: boolean;
  onManualSearch: () => void;
  onAddManualItem: (item: StockItem) => void;
  onQtyChange: (itemCode: string, qty: number) => void;
}

const toNum = (v: number | null | undefined) => Number(v ?? 0);

/** 실출고수량 = ceil(요청/포장단위)*포장단위. 포장단위<=0이면 요청 그대로 */
const calcIssueQty = (requestQty: number, minPackQty: number) =>
  minPackQty > 0 && requestQty > 0 ? Math.ceil(requestQty / minPackQty) * minPackQty : requestQty;

/**
 * 목록이 빈 원인을 구분한다.
 * - BOM 미등록(bomCount 0)  - 원자재 없음(rawCount 0)  - 기출고/현장재고로 충족(coveredCount > 0)
 * 셋은 대응 방법이 완전히 달라서 같은 문구로 묶으면 안 된다.
 */
export default function IssueRequestCreatePanel({
  items,
  summary,
  loadFailed,
  isLoadingBom,
  processCode,
  onProcessCodeChange,
  reason,
  onReasonChange,
  reasonOptions,
  manualQuery,
  onManualQueryChange,
  manualResults,
  isSearchingManual,
  onManualSearch,
  onAddManualItem,
  onQtyChange,
}: IssueRequestCreatePanelProps) {
  const { t } = useTranslation();

  const emptyReason = loadFailed
    ? null
    : !summary
    ? t('material.request.noBomItems')
    : summary.bomCount === 0
      ? t('material.request.noBomRegistered', { date: summary.bomEffectiveDate })
      : summary.rawCount === 0
        ? t('material.request.noRawInBom')
        : summary.coveredCount > 0
          ? t('material.request.allCovered')
          : t('material.request.noBomItems');

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
      {/* 요청 조건 입력 줄 - 툴바가 아니라 폼이라는 것을 레이블로 드러낸다 */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-muted">{t('material.issue.processLabel', '출고 공정')}</span>
          <div className="w-48">
            <ProcessSelect value={processCode} onChange={onProcessCodeChange} fullWidth required />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-muted">{t('material.request.reasonLabel')}</span>
          <div className="w-48">
            <Select options={reasonOptions} value={reason} onChange={onReasonChange} fullWidth />
          </div>
        </label>
        <div
          className={`ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            processCode
              ? 'bg-primary/5 text-primary'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}
        >
          <Info className="w-4 h-4 shrink-0" />
          <span>
            {processCode
              ? t('material.request.processStockNotice', { defaultValue: '지정 공정의 공정재고(장착 대기)로 적재됩니다.' })
              : t('material.issue.processRequired', { defaultValue: '출고 공정을 선택하세요.' })}
          </span>
        </div>
      </div>

      {/* BOM 외 품목 직접추가 */}
      <div className="flex gap-2">
        <Input
          placeholder={t('material.request.searchPartPlaceholder')}
          value={manualQuery}
          onChange={(e) => onManualQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onManualSearch(); }}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
        <Button size="sm" variant="secondary" onClick={onManualSearch} disabled={isSearchingManual}>
          {isSearchingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.search')}
        </Button>
      </div>
      {manualResults.length > 0 && (
        <div className="border border-border rounded-lg max-h-32 overflow-auto">
          {manualResults.map((item) => {
            const added = items.some((r) => r.itemCode === item.itemCode);
            return (
              <div key={item.itemCode} className="flex items-center gap-2 px-3 py-1.5 text-sm border-t border-border first:border-t-0">
                <span className="font-mono text-xs">{item.itemCode}</span>
                <span className="flex-1 truncate">{item.itemName}</span>
                <HelpTooltip description={t(added ? 'material.request.alreadyAdded' : 'material.request.addToRequest')} focusable={added}><button
                  onClick={() => onAddManualItem(item)}
                  disabled={added}
                  className={`disabled:pointer-events-none p-1 rounded ${added ? 'text-text-muted opacity-50' : 'text-primary hover:bg-primary/10'}`}
                  title={added ? t('material.request.alreadyAdded') : t('material.request.addToRequest')}
                >
                  <Plus className="w-4 h-4" />
                </button></HelpTooltip>
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
      ) : items.length === 0 ? (
        emptyReason ? (
          <div className="flex flex-col items-center justify-center gap-2 h-32 px-6 text-center text-sm text-text-muted">
            <PackageSearch className="h-7 w-7 opacity-40" />
            <span>{emptyReason}</span>
          </div>
        ) : null
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
              <th className="text-right px-3 py-2 font-medium w-28">{t('material.request.currentStock')}</th>
              <th className="text-right px-3 py-2 font-medium w-24">{t('material.request.issuableQty')}</th>
              <th className="text-center px-3 py-2 font-medium w-32">{t('material.request.requestQtyLabel')}</th>
              <th className="text-right px-3 py-2 font-medium w-20">{t('material.request.minPackQty', { defaultValue: '불출포장단위' })}</th>
              <th className="text-right px-3 py-2 font-medium w-24">{t('material.request.issueQtyLabel', { defaultValue: '실출고수량' })}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const currentStock = toNum(item.currentStock);
              const issuableQty = toNum(item.issuableQty);
              const pendingIqcQty = toNum(item.pendingIqcQty);
              const overStock = item.requestQty > currentStock;
              // 총 재고는 있는데 IQC 대기분 때문에 실제로는 못 나가는 경우를 따로 구분한다.
              const overIssuable = !overStock && item.requestQty > issuableQty;
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
                    <div>{currentStock.toLocaleString()}</div>
                    {pendingIqcQty > 0 && (
                      <div className="text-[11px] font-normal text-amber-600 dark:text-amber-400">
                        {t('material.request.pendingIqcShort')} {pendingIqcQty.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${overIssuable ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'}`}
                    title={overIssuable ? t('material.request.issuableShortage') : undefined}
                  >
                    {issuableQty.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <QtyInput
                        value={toNum(item.requestQty)}
                        onChange={(qty) => onQtyChange(item.itemCode, qty)}
                        placeholder="0"
                        fullWidth
                        className={`h-8 py-1 text-right ${overStock ? 'border-red-400' : overIssuable ? 'border-amber-400' : ''}`}
                      />
                      {overStock && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                      {overIssuable && (
                        <AlertTriangle
                          className="w-4 h-4 shrink-0 text-amber-500"
                          aria-label={t('material.request.issuableShortage')}
                        />
                      )}
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
  );
}
