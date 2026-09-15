'use client';

/**
 * @file components/material/issue-from-request/RequestItemList.tsx
 * @description 출고 모달 좌측 — 요청 품목 목록. 행 클릭으로 우측 LOT 패널과 연동한다.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { AllocationMap, IssueRow } from './types';
import { sumSlices } from './types';

interface Props {
  rows: IssueRow[];
  allocation: AllocationMap;
  selectedRowKey: string | null;
  onSelect: (rowKey: string) => void;
}

export default function RequestItemList({ rows, allocation, selectedRowKey, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col overflow-hidden border border-border rounded-lg">
      <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-semibold text-text-muted">
          {t('material.issue.requestItems', { defaultValue: '요청 내역' })}
          <span className="ml-1 text-primary">({rows.length})</span>
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted dark:bg-slate-800 sticky top-0 z-10">
            <tr className="text-left text-text-muted">
              <th className="px-2 py-1.5">{t('common.partName', { defaultValue: '품목명' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.col.requestQty')}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.issuedLabel')}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.remainingLabel')}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.issuableQty', { defaultValue: '가용(IQC합격)' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.pendingIqcQty', { defaultValue: '미검사' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.targetQty', { defaultValue: '실출고' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.allocatedQty', { defaultValue: '배분' })}</th>
              <th className="px-2 py-1.5 text-right">{t('material.issue.shortageQty', { defaultValue: '부족' })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const allocated = sumSlices(allocation[row.rowKey]);
              const shortage = row.packRemainQty - allocated;
              const isSelected = row.rowKey === selectedRowKey;
              return (
                <tr
                  key={row.rowKey}
                  onClick={() => onSelect(row.rowKey)}
                  className={`border-t border-border cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                >
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-text truncate">{row.itemName}</div>
                    <div className="font-mono text-[10px] text-text-muted truncate">{row.itemCode}</div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-text-muted whitespace-nowrap">
                    {row.requestQty.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right text-text-muted whitespace-nowrap">
                    {(row.issuedQty ?? 0).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right text-text whitespace-nowrap">
                    {row.remainQty.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <span className={(row.issuableQty ?? 0) < row.remainQty ? 'font-medium text-red-600 dark:text-red-400' : 'text-text-muted'}>
                      {(row.issuableQty ?? 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <span className={(row.pendingIqcQty ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'}>
                      {(row.pendingIqcQty ?? 0) > 0 ? (row.pendingIqcQty ?? 0).toLocaleString() : '-'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-text whitespace-nowrap">
                    {row.packRemainQty.toLocaleString()} {row.unit}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-primary whitespace-nowrap">
                    {allocated.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {shortage > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {shortage.toLocaleString()}
                      </span>
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 inline-block" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
