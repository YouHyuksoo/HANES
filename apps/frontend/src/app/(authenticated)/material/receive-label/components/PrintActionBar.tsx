'use client';

/**
 * @file components/PrintActionBar.tsx
 * @description 라벨 발행 액션 바 - 출력 방식 선택 및 인쇄 실행
 *
 * 초보자 가이드:
 * 1. 출력 방식 선택: 브라우저 인쇄 / ZPL USB / ZPL TCP
 * 2. ZPL 선택 시 Zebra 에이전트 연결 상태 표시
 * 3. 프린터 선택 드롭다운 (ZPL USB 모드 전용)
 * 4. 인쇄 버튼으로 선택 방식에 따라 출력
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { useZebraPrinter } from '@/hooks/useZebraPrinter';
import { api } from '@/services/api';

/** 출력 방식 타입 */
type PrintMethod = 'BROWSER' | 'ZPL_USB' | 'ZPL_TCP';

interface PrintActionBarProps {
  selectedCount: number;
  selectedQty: number;
  templateId: string | null;
  templatePrintMode: string;
  selectedLotIds: string[];
  onBrowserPrint: () => void;
  printing: boolean;
  onPrintComplete?: () => void;
}

/** ZPL 생성 API 호출 후 인쇄 로그 저장하는 공통 헬퍼 */
async function generateAndLogZpl(
  templateId: string, matUids: string[], method: PrintMethod, printedCount: number,
) {
  await api.post('/material/label-print/log', {
    templateId, category: 'mat_lot', printMode: method,
    uidList: matUids, labelCount: printedCount, status: 'SUCCESS',
  });
}

export default function PrintActionBar({
  selectedCount, selectedQty, templateId, templatePrintMode,
  selectedLotIds, onBrowserPrint, printing, onPrintComplete,
}: PrintActionBarProps) {
  const { t } = useTranslation();
  const [printMethod, setPrintMethod] = useState<PrintMethod>('BROWSER');
  const [zplPrinting, setZplPrinting] = useState(false);
  const { isAgentAvailable, printers, selectedPrinter, setSelectedPrinter, sendZpl, error: zebraError } = useZebraPrinter();

  /** 출력 방식 옵션 (템플릿 모드에 따라 필터링) */
  const printMethodOptions = useMemo(() => {
    const b = { value: 'BROWSER', label: t('material.receiveLabel.printMethodBrowser') };
    const u = { value: 'ZPL_USB', label: t('material.receiveLabel.printMethodZplUsb') };
    const n = { value: 'ZPL_TCP', label: t('material.receiveLabel.printMethodZplTcp') };
    if (templatePrintMode === 'ZPL') return [u, n];
    if (templatePrintMode === 'BOTH') return [b, u, n];
    return [b];
  }, [templatePrintMode, t]);

  const printerOptions = useMemo(
    () => printers.map((p) => ({ value: p.uid, label: p.name })), [printers],
  );

  /** ZPL 인쇄 처리 (USB/TCP 공통) */
  const handleZplPrint = useCallback(async () => {
    if (!templateId || selectedLotIds.length === 0) return;
    setZplPrinting(true);
    try {
      const res = await api.post('/material/label-print/generate', { templateId, matUids: selectedLotIds });
      const zplDataList: string[] = res.data?.data ?? [];
      if (printMethod === 'ZPL_USB') {
        let ok = 0;
        for (const zpl of zplDataList) { if (await sendZpl(zpl)) ok++; }
        if (ok > 0) await generateAndLogZpl(templateId, selectedLotIds, 'ZPL_USB', ok);
      } else {
        await api.post('/material/label-print/tcp', { zplDataList });
        await generateAndLogZpl(templateId, selectedLotIds, 'ZPL_TCP', zplDataList.length);
      }
      onPrintComplete?.();
    } catch (err) {
      console.error(`ZPL ${printMethod} print failed:`, err);
    } finally { setZplPrinting(false); }
  }, [templateId, selectedLotIds, printMethod, sendZpl, onPrintComplete]);

  /** 인쇄 실행 */
  const handlePrint = useCallback(() => {
    if (printMethod === 'BROWSER') onBrowserPrint();
    else handleZplPrint();
  }, [printMethod, onBrowserPrint, handleZplPrint]);

  const isPrintDisabled = selectedCount === 0 || printing || zplPrinting
    || (printMethod === 'ZPL_USB' && (!isAgentAvailable || !selectedPrinter));
  const isProcessing = printing || zplPrinting;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 출력 방식 선택 */}
      {printMethodOptions.length > 1 && (
        <Select options={printMethodOptions} value={printMethod}
          onChange={(v) => setPrintMethod(v as PrintMethod)} className="w-44" />
      )}

      {/* ZPL USB: 프린터 선택 + 에이전트 상태 */}
      {printMethod === 'ZPL_USB' && (
        <>
          <Select options={printerOptions} value={selectedPrinter?.uid ?? ''}
            onChange={(uid) => setSelectedPrinter(printers.find((p) => p.uid === uid) ?? null)}
            placeholder={t('material.receiveLabel.selectPrinter')} className="w-48" />
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isAgentAvailable
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isAgentAvailable ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400'
            }`} />
            {isAgentAvailable
              ? t('material.receiveLabel.agentConnected')
              : t('material.receiveLabel.agentDisconnected')}
          </span>
          {zebraError && (
            <span className="text-xs text-red-500 dark:text-red-400">{zebraError}</span>
          )}
        </>
      )}

      {/* 발행 버튼 */}
      <Button size="sm" onClick={handlePrint} disabled={isPrintDisabled}>
        <Printer className="w-4 h-4 mr-1" />
        {isProcessing ? '...' : t('material.receiveLabel.printLabel')}
        {selectedQty > 0 && ` (${selectedQty}${t('material.receiveLabel.sheets')})`}
      </Button>
    </div>
  );
}
