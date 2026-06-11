"use client";

/**
 * @file src/app/(authenticated)/material/receive/components/ReceiveScanModal.tsx
 * @description 거래처 바코드와 자체부착 바코드(matUid)를 순환 스캔해 자재 입고를 확정하는 모달
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, PackageCheck, ScanLine, Trash2, X } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import WarehouseSelect from '@/components/shared/WarehouseSelect';
import api from '@/services/api';
import type { ReceivableLot, ReceiveScanPair } from './types';

interface ReceiveScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  receivable: ReceivableLot[];
}

type ScanPhase = 'vendor' | 'own';

export default function ReceiveScanModal({ isOpen, onClose, onSuccess, receivable }: ReceiveScanModalProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ScanPhase>('own');
  const [input, setInput] = useState('');
  const [pendingMatUid, setPendingMatUid] = useState('');
  const [pairs, setPairs] = useState<ReceiveScanPair[]>([]);
  const [warehouseCode, setWarehouseCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const receivableByUid = useMemo(() => new Map(receivable.map((lot) => [lot.matUid, lot])), [receivable]);
  const scannedOwnBarcodes = useMemo(() => new Set(pairs.map((pair) => pair.matUid)), [pairs]);
  const totalQty = pairs.reduce((sum, pair) => sum + (receivableByUid.get(pair.matUid)?.remainingQty || 0), 0);

  useEffect(() => {
    if (!isOpen) return;
    setPhase('own');
    setInput('');
    setPendingMatUid('');
    setPairs([]);
    setError('');
    setSaving(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleOwnScan = useCallback((matUid: string) => {
    const lot = receivableByUid.get(matUid);
    if (!lot) {
      setError(`입고대기 대상이 아닙니다: ${matUid}`);
      setInput('');
      focusInput();
      return;
    }
    if (lot.receivingBlockedReason) {
      setError(`${matUid}: ${lot.receivingBlockedReason}`);
      setInput('');
      focusInput();
      return;
    }
    if (scannedOwnBarcodes.has(matUid)) {
      setError(`이미 스캔한 자체바코드입니다: ${matUid}`);
      setInput('');
      focusInput();
      return;
    }

    setPendingMatUid(matUid);
    setPhase('vendor');
    setInput('');
    setError('');
    focusInput();
  }, [focusInput, receivableByUid, scannedOwnBarcodes]);

  const handleVendorScan = useCallback((barcode: string) => {
    setPairs((prev) => [{ vendorBarcode: barcode, matUid: pendingMatUid }, ...prev]);
    setPendingMatUid('');
    setPhase('own');
    setInput('');
    setError('');
    focusInput();
  }, [focusInput, pendingMatUid]);

  const handleScan = useCallback(() => {
    const barcode = input.trim();
    if (!barcode) return;
    if (phase === 'own') {
      handleOwnScan(barcode);
    } else {
      handleVendorScan(barcode);
    }
  }, [handleOwnScan, handleVendorScan, input, phase]);

  const removePair = useCallback((matUid: string) => {
    setPairs((prev) => prev.filter((pair) => pair.matUid !== matUid));
    focusInput();
  }, [focusInput]);

  const resetPendingMat = useCallback(() => {
    setPendingMatUid('');
    setPhase('own');
    setInput('');
    setError('');
    focusInput();
  }, [focusInput]);

  const handleReceive = useCallback(async () => {
    if (pairs.length === 0) return;
    if (!warehouseCode) {
      setError('입고 창고를 선택해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/material/receiving', {
        items: pairs
          .slice()
          .reverse()
          .map((pair) => {
            const lot = receivableByUid.get(pair.matUid);
            return {
              matUid: pair.matUid,
              qty: lot?.remainingQty || 0,
              warehouseId: warehouseCode,
              vendorBarcode: pair.vendorBarcode,
            };
          }),
      });
      onSuccess();
      onClose();
    } catch {
      // API 인터셉터에서 상세 메시지를 표시한다.
    } finally {
      setSaving(false);
      focusInput();
    }
  }, [focusInput, onClose, onSuccess, pairs, receivableByUid, warehouseCode]);

  const phaseTitle = phase === 'own' ? '자재 바코드 스캔' : '거래처 바코드 스캔';
  const phaseHint = phase === 'own'
    ? '자체부착 바코드(자재 시리얼)를 먼저 스캔하세요.'
    : `자재 ${pendingMatUid}에 매핑할 거래처 바코드를 스캔하세요.`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="스캔 입고처리" size="2xl" closeOnOverlayClick={false}>
      <div className="space-y-4">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <label className="text-sm font-medium text-text whitespace-nowrap">
            입고 창고
          </label>
          <WarehouseSelect
            warehouseType="RAW"
            autoSelectDefault
            value={warehouseCode}
            onChange={(v) => setWarehouseCode(v)}
            fullWidth
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Input
            ref={inputRef}
            label={phaseTitle}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleScan();
            }}
            placeholder={phase === 'own' ? '자체부착 바코드' : '거래처 바코드'}
            hint={phaseHint}
            leftIcon={<ScanLine className="w-4 h-4" />}
            fullWidth
          />
          <Button onClick={handleScan} disabled={!input.trim()}>
            <ScanLine className="w-4 h-4 mr-1" />
            스캔등록
          </Button>
        </div>

        {phase === 'vendor' && (
          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span>
              스캔된 자재 바코드: <span className="font-mono font-semibold">{pendingMatUid}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={resetPendingMat}>
              <X className="w-4 h-4 mr-1" />
              취소
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2 text-sm">
            <span className="font-medium text-text">스캔 매핑 목록</span>
            <span className="text-text-muted">
              {pairs.length.toLocaleString()}건 / {totalQty.toLocaleString()} {t('common.ea', '개')}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-text-muted">
                <tr>
                  <th className="px-3 py-2">거래처 바코드</th>
                  <th className="px-3 py-2">자체부착 바코드</th>
                  <th className="px-3 py-2">품번</th>
                  <th className="px-3 py-2 text-right">입고수량</th>
                  <th className="w-10 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pairs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-text-muted">
                      스캔된 바코드 매핑이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pairs.map((pair) => {
                    const lot = receivableByUid.get(pair.matUid);
                    return (
                      <tr key={pair.matUid} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">{pair.vendorBarcode}</td>
                        <td className="px-3 py-2 font-mono">{pair.matUid}</td>
                        <td className="px-3 py-2">{lot?.part?.itemCode || lot?.itemCode || '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">{(lot?.remainingQty || 0).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removePair(pair.matUid)}
                            className="text-text-muted hover:text-red-600 dark:hover:text-red-400"
                            aria-label="스캔 매핑 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            입고대기 그리드 선택 없이 스캔된 매핑만 입고 처리됩니다.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              <X className="w-4 h-4 mr-1" />
              {t('common.close')}
            </Button>
            <Button onClick={handleReceive} disabled={pairs.length === 0 || !warehouseCode} isLoading={saving}>
              <PackageCheck className="w-4 h-4 mr-1" />
              입고처리 ({pairs.length})
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
