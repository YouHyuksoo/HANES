"use client";

/**
 * @file material/arrival/page.tsx
 * @description IQC005 — 자재 입하관리 (PO 라인 단위 메인 그리드)
 *
 * 초보자 가이드:
 * 1. PO 라인 그리드: 메인 영역. 행 클릭 또는 [자재입하] 버튼 → PoLineReceiptModal
 * 2. 저장 흐름: PoLineReceiptModal → SerialIssueConfirmModal → POST → MatLabelPreviewModal
 * 3. 4단계 행 배경: 미입하/일부입하/잔량0/CLOSE
 * 4. ManualArrivalModal은 유지 (별도 워크플로)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, RefreshCw, Plus, Search } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { useComCodeOptions } from '@/hooks/useComCode';
import api from '@/services/api';
import PoLineGrid from './components/PoLineGrid';
import PoLineReceiptModal from './components/PoLineReceiptModal';
import SerialIssueConfirmModal from './components/SerialIssueConfirmModal';
import MatLabelPreviewModal from './components/MatLabelPreviewModal';
import ManualArrivalModal from './components/ManualArrivalModal';
import type { PoLineRow, PoLineReceiptInput, PoLineReceiptResponse } from './components/types';

export default function ArrivalPage() {
  const { t } = useTranslation();

  // 데이터
  const [rows, setRows] = useState<PoLineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemCode, setItemCode] = useState('');
  const [poNo, setPoNo] = useState('');

  // 상태 다중선택 필터 (체크조건) — 기본값: CLOSE 제외 전체. 클라이언트 사이드 필터.
  const statusOptions = useComCodeOptions('PO_LINE_STATUS');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [statusInitialized, setStatusInitialized] = useState(false);
  useEffect(() => {
    if (!statusInitialized && statusOptions.length) {
      setSelectedStatuses(statusOptions.map((o) => o.value).filter((v) => v !== 'CLOSE'));
      setStatusInitialized(true);
    }
  }, [statusOptions, statusInitialized]);

  const toggleStatus = useCallback((code: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const visibleRows = useMemo(
    () => (statusInitialized ? rows.filter((r) => selectedStatuses.includes(r.lineStatus)) : rows),
    [rows, selectedStatuses, statusInitialized],
  );

  // 흐름 상태
  const [selectedLine, setSelectedLine] = useState<PoLineRow | null>(null);
  const [pendingInput, setPendingInput] = useState<{ input: PoLineReceiptInput; expectedCount: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [labelData, setLabelData] = useState<PoLineReceiptResponse | null>(null);
  const [labelMeta, setLabelMeta] = useState<{ itemName?: string; receivedDate?: string; mfgPartnerLabel?: string }>({});
  const [isManualOpen, setIsManualOpen] = useState(false);

  const fetchLines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/material/arrivals/po-lines', {
        params: {
          ...(itemCode && { itemCode }),
          ...(poNo && { poNo }),
        },
      });
      setRows(res.data?.data ?? []);
    } catch { setRows([]); }
    setLoading(false);
  }, [itemCode, poNo]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  const handleConfirmInput = (input: PoLineReceiptInput, expectedCount: number) => {
    setPendingInput({ input, expectedCount });
  };

  const handleSubmit = async () => {
    if (!pendingInput) return;
    setSubmitting(true);
    try {
      const res = await api.post('/material/arrivals/po-line', pendingInput.input);
      const data: PoLineReceiptResponse = res.data?.data;
      const enrichedSerials = (data?.serials ?? []).map((s) => ({
        matUid: s.matUid,
        initQty: s.initQty,
        arrivalSeq: s.arrivalSeq,
        itemCode: selectedLine?.itemCode ?? s.itemCode ?? '',
      }));
      setLabelMeta({
        itemName: selectedLine?.itemName,
        receivedDate: pendingInput.input.receivedDate,
        mfgPartnerLabel: pendingInput.input.mfgPartnerCode,
      });
      setLabelData({ ...data, serials: enrichedSerials });
      fetchLines();
      setPendingInput(null);
      setSelectedLine(null);
    } catch (err) {
      console.error('PO 라인 입하 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            {t('material.arrival.iqc005Title')}
          </h1>
          <p className="text-text-muted mt-1">{t('material.arrival.iqc005Description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchLines}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsManualOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('material.arrival.manualArrival')}
          </Button>
        </div>
      </div>

      {/* PO 라인 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <PoLineGrid
            data={visibleRows}
            isLoading={loading}
            onSelectLine={setSelectedLine}
            toolbarLeft={
              <div className="flex gap-2 flex-1 min-w-0 items-center flex-wrap">
                <div className="flex items-center gap-2 flex-shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1.5">
                  <span className="text-xs font-medium text-text-muted">{t('common.status')}</span>
                  {statusOptions.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-primary w-3.5 h-3.5"
                        checked={selectedStatuses.includes(opt.value)}
                        onChange={() => toggleStatus(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <Input
                  placeholder={t('common.partCode')}
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-44 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t('material.arrival.col.poNo')}
                    value={poNo}
                    onChange={(e) => setPoNo(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchLines}>
                  <Search className="w-4 h-4 mr-1" />{t('common.search')}
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 1라인 입하 모달 */}
      <PoLineReceiptModal
        isOpen={!!selectedLine}
        line={selectedLine}
        onClose={() => setSelectedLine(null)}
        onConfirm={handleConfirmInput}
      />

      {/* 시리얼 발급 확인 */}
      <SerialIssueConfirmModal
        isOpen={!!pendingInput}
        expectedCount={pendingInput?.expectedCount ?? 0}
        onConfirm={handleSubmit}
        onCancel={() => setPendingInput(null)}
        submitting={submitting}
      />

      {/* 라벨 미리보기 */}
      <MatLabelPreviewModal
        isOpen={!!labelData}
        data={labelData}
        itemName={labelMeta.itemName}
        receivedDate={labelMeta.receivedDate}
        mfgPartnerLabel={labelMeta.mfgPartnerLabel}
        onClose={() => setLabelData(null)}
      />

      {/* 수동 입하 */}
      <ManualArrivalModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onSuccess={() => { setIsManualOpen(false); fetchLines(); }}
      />
    </div>
  );
}
