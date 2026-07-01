"use client";

/**
 * @file src/app/(authenticated)/material/receive/components/ReceiveScanModal.tsx
 * @description 거래처 바코드와 자체부착 바코드(matUid)를 순환 스캔해 자재 입고를 확정하는 모달
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, PackageCheck, ScanLine, Trash2, X } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { BarcodeScanInput } from '@/components/shared';
import WarehouseSelect from '@/components/shared/WarehouseSelect';
import { useLocationOptions } from '@/hooks/useMasterOptions';
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
  const [autoLocation, setAutoLocation] = useState(true);
  const [locationCode, setLocationCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { options: locationOptions } = useLocationOptions(warehouseCode);

  const receivableByUid = useMemo(() => new Map(receivable.map((lot) => [lot.matUid, lot])), [receivable]);
  const scannedOwnBarcodes = useMemo(() => new Set(pairs.map((pair) => pair.matUid)), [pairs]);
  const totalQty = pairs.reduce((sum, pair) => sum + (receivableByUid.get(pair.matUid)?.remainingQty || 0), 0);

  useEffect(() => {
    if (!isOpen) return;
    setPhase('own');
    setInput('');
    setPendingMatUid('');
    setPairs([]);
    setAutoLocation(true);
    setLocationCode('');
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
      setError(t('material.receive.scan.notReceivable', '입고대기 대상이 아닙니다: {{matUid}}', { matUid }));
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
      setError(t('material.receive.scan.alreadyScanned', '이미 스캔한 자체바코드입니다: {{matUid}}', { matUid }));
      setInput('');
      focusInput();
      return;
    }

    setPendingMatUid(matUid);
    setPhase('vendor');
    setInput('');
    setError('');
    focusInput();
  }, [focusInput, receivableByUid, scannedOwnBarcodes, t]);

  const handleVendorScan = useCallback((barcode: string) => {
    setPairs((prev) => [{ vendorBarcode: barcode, matUid: pendingMatUid }, ...prev]);
    setPendingMatUid('');
    setPhase('own');
    setInput('');
    setError('');
    focusInput();
  }, [focusInput, pendingMatUid]);

  const handleScan = useCallback((rawBarcode?: string) => {
    const barcode = (rawBarcode ?? input).replace(/\r?\n|\r/g, '').trim();
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
      setError(t('material.receive.scan.selectWarehouse', '입고 창고를 선택해 주세요.'));
      return;
    }
    if (!autoLocation && !locationCode.trim()) {
      setError(t('material.receive.scan.selectLocation', '적재위치를 선택하거나 스캔해 주세요.'));
      return;
    }
    const manualLocation = !autoLocation ? locationCode.trim() : '';
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
              ...(manualLocation ? { locationCode: manualLocation } : {}),
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
  }, [focusInput, onClose, onSuccess, pairs, receivableByUid, warehouseCode, autoLocation, locationCode, t]);

  const phaseTitle = phase === 'own'
    ? t('material.receive.scan.ownTitle', '자재 바코드 스캔')
    : t('material.receive.scan.vendorTitle', '거래처 바코드 스캔');
  const phaseHint = phase === 'own'
    ? t('material.receive.scan.ownHint', '자체부착 바코드(자재 시리얼)를 먼저 스캔하세요.')
    : t('material.receive.scan.vendorHint', '자재 {{matUid}}에 매핑할 거래처 바코드를 스캔하세요.', { matUid: pendingMatUid });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.receive.scan.modalTitle', '스캔 입고처리')} size="2xl" closeOnOverlayClick={false}>
      <div className="space-y-4">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <label className="text-sm font-medium text-text whitespace-nowrap">
            {t('material.receive.warehouseLabel', '입고 창고')}
          </label>
          <WarehouseSelect
            warehouseType="RAW"
            autoSelectDefault
            value={warehouseCode}
            onChange={(v) => { setWarehouseCode(v); setLocationCode(''); }}
            fullWidth
          />
        </div>

        {/* 적재위치: 자동(품목마스터 STORAGE_LOCATION) / 수동(선택·스캔) */}
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-text whitespace-nowrap">
              {t('material.receive.locationLabel', '적재위치')}
            </label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary"
                checked={autoLocation}
                onChange={(e) => { setAutoLocation(e.target.checked); setError(''); }}
              />
              {t('material.receive.autoLocation', '품목마스터 지정 위치 자동 사용')}
            </label>
          </div>
          {autoLocation ? (
            <p className="text-xs text-text-muted">
              {t('material.receive.autoLocationHint', '각 품목마스터에 지정된 적재 로케이션으로 입고됩니다.')}
            </p>
          ) : (
            <div className="space-y-2">
              {locationOptions.length > 0 ? (
                <Select
                  options={locationOptions}
                  value={locationCode}
                  onChange={(v) => { setLocationCode(v); setError(''); }}
                  placeholder={t('material.receive.selectLocation', '로케이션 선택')}
                  fullWidth
                />
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t('material.receive.noLocation', '선택한 창고에 등록된 로케이션이 없습니다. 바코드로 직접 스캔하거나 창고관리에서 로케이션을 등록하세요.')}
                </p>
              )}
              <BarcodeScanInput
                value={locationCode}
                onChange={(value) => { setLocationCode(value); setError(''); }}
                onScan={(value) => { setLocationCode(value); setError(''); focusInput(); }}
                placeholder={t('material.receive.scanLocation', '로케이션 바코드 스캔')}
                className="font-mono"
                maintainFocus={false}
                fullWidth
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <BarcodeScanInput
            ref={inputRef}
            label={phaseTitle}
            value={input}
            onChange={setInput}
            onScan={handleScan}
            placeholder={phase === 'own'
              ? t('material.receive.scan.ownPlaceholder', '자체부착 바코드')
              : t('material.receive.scan.vendorPlaceholder', '거래처 바코드')}
            hint={phaseHint}
            fullWidth
          />
          <Button onClick={() => handleScan()} disabled={!input.trim()}>
            <ScanLine className="w-4 h-4 mr-1" />
            {t('material.receive.scan.scanRegister', '스캔등록')}
          </Button>
        </div>

        {phase === 'vendor' && (
          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span>
              {t('material.receive.scan.scannedMat', '스캔된 자재 바코드')}: <span className="font-mono font-semibold">{pendingMatUid}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={resetPendingMat}>
              <X className="w-4 h-4 mr-1" />
              {t('common.cancel', '취소')}
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
            <span className="font-medium text-text">{t('material.receive.scan.mappingList', '스캔 매핑 목록')}</span>
            <span className="text-text-muted">
              {t('material.receive.scan.countCases', '{{count}}건', { count: pairs.length })} / {totalQty.toLocaleString()} {t('common.ea', '개')}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-text-muted">
                <tr>
                  <th className="px-3 py-2">{t('material.receive.scan.vendorBarcode', '거래처 바코드')}</th>
                  <th className="px-3 py-2">{t('material.receive.scan.ownBarcode', '자체부착 바코드')}</th>
                  <th className="px-3 py-2">{t('material.receive.scan.partNo', '품번')}</th>
                  <th className="px-3 py-2 text-right">{t('material.receive.col.inputQty', '입고수량')}</th>
                  <th className="w-10 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pairs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-text-muted">
                      {t('material.receive.scan.noMapping', '스캔된 바코드 매핑이 없습니다.')}
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
                            aria-label={t('material.receive.scan.removeMapping', '스캔 매핑 삭제')}
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
            {t('material.receive.scan.footerNotice', '입고대기 그리드 선택 없이 스캔된 매핑만 입고 처리됩니다.')}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              <X className="w-4 h-4 mr-1" />
              {t('common.close')}
            </Button>
            <Button onClick={handleReceive} disabled={pairs.length === 0 || !warehouseCode} isLoading={saving}>
              <PackageCheck className="w-4 h-4 mr-1" />
              {t('material.receive.scanReceive', '입고처리')} ({pairs.length})
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
