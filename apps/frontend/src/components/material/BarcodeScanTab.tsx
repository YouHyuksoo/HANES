'use client';

/**
 * @file src/components/material/BarcodeScanTab.tsx
 * @description 바코드 스캔 출고 탭 - LOT번호 스캔 → 조회 → 전량 출고
 *
 * 초보자 가이드:
 * 1. **스캔 입력**: 큰 입력 필드에 LOT번호 입력 (바코드 스캐너 대응)
 * 2. **Enter 키**: handleScan() 호출 → LOT 정보 조회
 * 3. **스캔 결과**: 품목코드, 품목명, LOT번호, 수량, IQC상태 표시
 * 4. **전량출고**: POST /material/issues/scan → 이력 추가 → 다음 스캔 준비
 * 5. **스캔 이력**: 금일 스캔 출고 이력 DataGrid (최신순)
 */
import { useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  QrCode, Package, XCircle, AlertTriangle, CheckCircle, Loader2,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, Button } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useBarcodeScan } from '@/hooks/material/useBarcodeScan';
import type { ScanHistoryItem } from '@/hooks/material/useBarcodeScan';

export default function BarcodeScanTab() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    scanInput, setScanInput,
    scannedLot, scanHistory, isScanning, error,
    handleScan, handleIssue, handleCancel,
  } = useBarcodeScan();

  // 페이지 로드 시 입력 필드에 자동 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 출고 완료 후 포커스 복원
  useEffect(() => {
    if (!scannedLot && !error) {
      inputRef.current?.focus();
    }
  }, [scannedLot, error]);

  // Enter 키 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  // 전량출고 후 포커스 복원
  const handleIssueAndFocus = async () => {
    await handleIssue();
    inputRef.current?.focus();
  };

  // 스캔 이력 컬럼 정의
  const historyColumns = useMemo<ColumnDef<ScanHistoryItem>[]>(() => [
    {
      accessorKey: 'issuedAt',
      header: t('material.issue.scanTime', { defaultValue: '시간' }),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => {
        const d = new Date(getValue() as string);
        return <span>{d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>;
      },
    },
    { accessorKey: 'partCode', header: t('common.partCode', { defaultValue: '품목코드' }), size: 120, meta: { filterType: 'text' as const } },
    { accessorKey: 'partName', header: t('common.partName', { defaultValue: '품목명' }), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'lotNo', header: t('material.col.lotNo'), size: 160, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'issueQty',
      header: t('material.col.issuedQty'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => (
        <span className="font-medium">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'unit',
      header: t('common.unit'),
      size: 60,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-text-muted">{getValue() as string}</span>,
    },
  ], [t]);

  return (
    <div className="space-y-6">
      {/* 스캔 입력 영역 */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('material.issue.scanPlaceholder', { defaultValue: 'LOT 번호를 스캔하거나 입력하세요...' })}
                  className="w-full h-14 pl-14 pr-4 text-lg font-medium bg-background dark:bg-slate-800 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-text placeholder:text-text-muted"
                  autoComplete="off"
                />
              </div>
            </div>
            <Button
              onClick={handleScan}
              disabled={!scanInput.trim() || isScanning}
              className="h-14 px-6"
            >
              {isScanning ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <QrCode className="w-5 h-5 mr-2" />
                  {t('common.search')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 에러 표시 */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* 스캔 결과 카드 */}
      {scannedLot && (
        <Card>
          <CardContent>
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <h3 className="text-lg font-semibold text-text flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  {t('material.issue.scanResult', { defaultValue: 'LOT 조회 결과' })}
                </h3>
                <div className="grid grid-cols-3 gap-4 p-4 bg-background dark:bg-slate-800 rounded-lg">
                  <InfoItem
                    label={t('common.partCode', { defaultValue: '품목코드' })}
                    value={scannedLot.partCode}
                  />
                  <InfoItem
                    label={t('common.partName', { defaultValue: '품목명' })}
                    value={scannedLot.partName}
                  />
                  <InfoItem
                    label={t('material.col.lotNo')}
                    value={scannedLot.lotNo}
                    highlight
                  />
                  <InfoItem
                    label={t('material.issue.currentQty', { defaultValue: '현재수량' })}
                    value={`${(scannedLot.remainQty ?? scannedLot.qty)?.toLocaleString()} ${scannedLot.unit ?? 'EA'}`}
                  />
                  <InfoItem
                    label="IQC"
                    value={scannedLot.iqcStatus}
                    badge
                  />
                  <InfoItem
                    label={t('material.col.supplier', { defaultValue: '공급업체' })}
                    value={scannedLot.supplierName ?? '-'}
                  />
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
              <Button variant="secondary" onClick={handleCancel}>
                <XCircle className="w-4 h-4 mr-1" />
                {t('common.cancel')}
              </Button>
              <Button onClick={handleIssueAndFocus}>
                <Package className="w-4 h-4 mr-1" />
                {t('material.issue.fullIssue', { defaultValue: '전량출고' })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 금일 스캔 출고 이력 */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-text mb-3">
            {t('material.issue.scanHistoryTitle', { defaultValue: '금일 스캔 출고 이력' })}
            {scanHistory.length > 0 && (
              <span className="ml-2 text-text-muted font-normal">({scanHistory.length}{t('common.count')})</span>
            )}
          </h3>
          <DataGrid
            data={scanHistory}
            columns={historyColumns}
            pageSize={10}
            emptyMessage={t('material.issue.noScanHistory', { defaultValue: '스캔 출고 이력이 없습니다.' })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** 정보 표시 아이템 (인라인 서브 컴포넌트) */
function InfoItem({
  label, value, highlight, badge,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  badge?: boolean;
}) {
  return (
    <div>
      <span className="text-xs text-text-muted">{label}</span>
      <div className="mt-0.5">
        {badge ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            {value}
          </span>
        ) : (
          <span className={`text-sm ${highlight ? 'font-bold text-primary' : 'font-medium text-text'}`}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
