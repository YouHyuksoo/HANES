'use client';

/**
 * @file material/issue/components/IssueScanPanel.tsx
 * @description 우측 바코드 스캔 출고 패널 (양산 고정) — 상단 고정 스캔영역 + 하단 금일 이력
 *
 * /product/receive의 ReceivablePanel과 동일한 compact 레이아웃 패턴 사용:
 * - 상단(고정): LOT 스캔 입력 + 조회 결과 + 전량출고 버튼
 * - 하단(스크롤): 금일 스캔 출고 이력 테이블
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  QrCode, AlertTriangle, CheckCircle, XCircle, Package, Loader2, ClipboardList, X,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { BarcodeScanInput, ProcessSelect } from '@/components/shared';
import JobOrderSelectModal, { type JobOrder } from '@/components/production/JobOrderSelectModal';
import { useBarcodeScan } from '@/hooks/material/useBarcodeScan';

/** 양산계정 고정 */
const PRODUCTION_ISSUE_TYPE = 'PRODUCTION';

export default function IssueScanPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isJobOrderModalOpen, setIsJobOrderModalOpen] = useState(false);
  const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);

  const {
    scanInput, setScanInput,
    processCode, setProcessCode,
    setOrderNo,
    scannedLot, scanHistory, isScanning, error,
    handleScan, handleIssue, handleCancel,
    setIssueType,
  } = useBarcodeScan();

  // 작업지시 선택 → orderNo 전송 + 출고 공정 기본값을 작업지시 공정으로
  const handleSelectJobOrder = useCallback((jobOrder: JobOrder) => {
    setSelectedJobOrder(jobOrder);
    setOrderNo(jobOrder.orderNo);
    if (jobOrder.processCode) setProcessCode(jobOrder.processCode);
    setIsJobOrderModalOpen(false);
  }, [setOrderNo, setProcessCode]);

  const handleClearJobOrder = useCallback(() => {
    setSelectedJobOrder(null);
    setOrderNo('');
  }, [setOrderNo]);

  // 양산계정 고정
  useEffect(() => {
    setIssueType(PRODUCTION_ISSUE_TYPE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마운트 시 포커스
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // 출고 완료 후 포커스 복원
  useEffect(() => {
    if (!scannedLot && !error) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [scannedLot, error]);

  const handleIssueAndFocus = async () => {
    await handleIssue();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 상단 고정: 스캔 입력 영역 */}
      <div className="flex-shrink-0 p-3 border-b border-border space-y-2">
        <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-primary" />
          {t('material.issue.tab.scan')}
          <span className="ml-auto text-xs font-normal text-text-muted px-1.5 py-0.5 bg-muted rounded">
            {t('material.issueAccount')}: 양산
          </span>
        </h2>

        {/* 작업지시 선택(선택 사항) — 지정 시 해당 작업지시 출고요청에 우선 배분 + MAT_ISSUES.ORDER_NO 기록 */}
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">
            {t('material.issue.jobOrderLabel', { defaultValue: '작업지시' })}
          </label>
          {selectedJobOrder ? (
            <div className="flex items-center gap-2 h-9 px-2.5 border border-primary/40 bg-primary/5 rounded-lg text-xs min-w-0">
              <ClipboardList className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="font-mono font-semibold text-primary truncate">{selectedJobOrder.orderNo}</span>
              <span className="text-text-muted truncate flex-1 min-w-0">{selectedJobOrder.itemName}</span>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-surface flex-shrink-0"
                onClick={handleClearJobOrder}
                disabled={isScanning}
                aria-label={t('common.clear', { defaultValue: '해제' })}
              >
                <X className="w-3.5 h-3.5 text-text-muted" />
              </button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsJobOrderModalOpen(true)}
              disabled={isScanning}
              className="w-full h-9 justify-start text-xs"
            >
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
              {t('material.issue.selectJobOrder', { defaultValue: '작업지시 선택' })}
              <span className="ml-auto text-text-muted font-normal">
                {t('material.issue.noJobOrder', { defaultValue: '미지정 시 요청 자동 배분' })}
              </span>
            </Button>
          )}
        </div>

        <ProcessSelect
          label={t('material.issue.processLabel', { defaultValue: '출고 공정' })}
          value={processCode}
          onChange={setProcessCode}
          fullWidth
          required
          disabled={isScanning}
        />

        {/* LOT 스캔 입력 */}
        <div className="flex gap-1.5">
          <div className="flex-1 min-w-0">
            <BarcodeScanInput
              ref={inputRef}
              value={scanInput}
              onChange={setScanInput}
              onScan={handleScan}
              placeholder={t('material.issue.scanPlaceholder', { defaultValue: 'LOT 번호 스캔...' })}
              className="h-9 text-sm"
              fullWidth
              disabled={isScanning || !processCode}
            />
          </div>
          <Button
            onClick={() => handleScan()}
            disabled={!scanInput.trim() || isScanning}
            size="sm"
            className="flex-shrink-0 h-9"
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t('common.search')
            )}
          </Button>
        </div>

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 스캔 결과 */}
        {scannedLot && (
          <div className="border border-border rounded-md p-2.5 bg-surface space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-text">{t('material.issue.scanResult', { defaultValue: 'LOT 조회 결과' })}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>
                <span className="text-text-muted">{t('common.partCode', { defaultValue: '품목코드' })}</span>
                <p className="font-medium text-text truncate">{scannedLot.itemCode}</p>
              </div>
              <div>
                <span className="text-text-muted">{t('material.col.matUid', { defaultValue: 'LOT' })}</span>
                <p className="font-bold text-primary truncate">{scannedLot.matUid}</p>
              </div>
              <div className="col-span-2">
                <span className="text-text-muted">{t('common.partName', { defaultValue: '품목명' })}</span>
                <p className="font-medium text-text truncate">{scannedLot.itemName}</p>
              </div>
              <div>
                <span className="text-text-muted">{t('material.issue.currentQty', { defaultValue: '수량' })}</span>
                <p className="font-semibold text-text">
                  {(scannedLot.remainQty ?? scannedLot.qty)?.toLocaleString()} {scannedLot.unit ?? 'EA'}
                </p>
              </div>
              <div>
                <span className="text-text-muted">IQC</span>
                <p className="font-medium text-text">{scannedLot.iqcStatus}</p>
              </div>
            </div>
            <div className="flex gap-1.5 pt-1 border-t border-border">
              <Button variant="secondary" size="sm" onClick={handleCancel} className="flex-1 h-8 text-xs">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleIssueAndFocus} disabled={!processCode} className="flex-1 h-8 text-xs">
                <Package className="w-3.5 h-3.5 mr-1" />
                {t('material.issue.fullIssue', { defaultValue: '전량출고' })}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 스크롤: 금일 스캔 이력 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-2 border-b border-border bg-muted/50 sticky top-0">
          <span className="text-xs font-semibold text-text-muted">
            {t('material.issue.scanHistoryTitle', { defaultValue: '금일 스캔 출고 이력' })}
            {scanHistory.length > 0 && (
              <span className="ml-1 text-primary">({scanHistory.length})</span>
            )}
          </span>
        </div>
        {scanHistory.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            {t('material.issue.noScanHistory', { defaultValue: '스캔 이력 없음' })}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted dark:bg-slate-800 sticky top-8 z-10">
              <tr className="text-left text-text-muted">
                <th className="px-3 py-1.5">{t('material.issue.scanTime', { defaultValue: '시간' })}</th>
                <th className="px-3 py-1.5">{t('common.partName', { defaultValue: '품목명' })}</th>
                <th className="px-3 py-1.5 text-right">{t('material.col.issuedQty', { defaultValue: '수량' })}</th>
              </tr>
            </thead>
            <tbody>
              {scanHistory.map((item, i) => (
                <tr
                  key={`${item.matUid}-${i}`}
                  className="border-t border-border hover:bg-muted/50"
                >
                  <td className="px-3 py-1.5 text-text-muted whitespace-nowrap">
                    {new Date(item.issuedAt).toLocaleTimeString(undefined, {
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-1.5 truncate max-w-0" style={{ maxWidth: 100 }}>
                    <div className="truncate">{item.itemName ?? item.itemCode}</div>
                    {/* 배분된 출고요청 번호 — 무매칭이면 표시 없음 */}
                    {item.allocatedRequestNos.length > 0 && (
                      <div className="truncate text-[10px] text-primary font-mono">
                        {t('material.issue.allocatedTo', { defaultValue: '배분' })}: {item.allocatedRequestNos.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-text whitespace-nowrap">
                    {(item.issueQty ?? 0).toLocaleString()} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <JobOrderSelectModal
        isOpen={isJobOrderModalOpen}
        onClose={() => setIsJobOrderModalOpen(false)}
        onConfirm={handleSelectJobOrder}
      />
    </div>
  );
}
