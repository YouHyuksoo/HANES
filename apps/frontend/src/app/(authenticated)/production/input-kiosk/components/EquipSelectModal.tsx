"use client";

/**
 * @file components/EquipSelectModal.tsx
 * @description 설비 선택 모달 — 바코드 스캔 또는 목록에서 수동 선택
 *
 * 초보자 가이드:
 * - 바코드 스캔: 모달 열리면 스캔 입력창 자동 포커스 → Enter 시 equipCode 매칭
 * - 수동 선택: 검색 필터 + 목록 클릭
 * - 스캔 성공/실패 시 시각적 피드백 표시
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Scan, Search, Cpu, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useScanInputFocus } from '@/hooks/useScanInputFocus';

interface EquipOption { equipCode: string; equipName: string; processCode?: string; processName?: string; }

interface EquipSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  equips: EquipOption[];
  onSelect: (equip: EquipOption) => void;
}

type ScanStatus = 'idle' | 'ok' | 'error';

export default function EquipSelectModal({ isOpen, onClose, equips, onSelect }: EquipSelectModalProps) {
  const { t } = useTranslation();
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState('');
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  // 모달 열린 동안 스캔 입력창 항상 포커스 유지 (수동 검색 입력은 guard로 허용)
  useScanInputFocus(scanRef, isOpen);

  // 모달 열릴 때마다 초기화 + 스캔창 포커스
  useEffect(() => {
    if (isOpen) {
      setScanValue('');
      setScanStatus('idle');
      setSearchQuery('');
      setTimeout(() => scanRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleScanSelect = useCallback((code: string) => {
    const trimmed = code.trim().toUpperCase();
    const found = equips.find(e => e.equipCode.toUpperCase() === trimmed);
    if (found) {
      setScanStatus('ok');
      setTimeout(() => {
        onSelect(found);
        onClose();
      }, 400);
    } else {
      setScanStatus('error');
      setTimeout(() => {
        setScanStatus('idle');
        setScanValue('');
        scanRef.current?.focus();
      }, 1200);
    }
  }, [equips, onSelect, onClose]);

  const handleScanKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanValue.trim()) {
      handleScanSelect(scanValue);
    }
  }, [scanValue, handleScanSelect]);

  const filtered = equips.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.equipCode.toLowerCase().includes(q) || e.equipName.toLowerCase().includes(q);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.equip.modalTitle')} size="md">
      <div className="space-y-4">

        {/* 바코드 스캔 영역 */}
        <div className={`rounded-lg border-2 p-4 transition-colors ${
          scanStatus === 'ok'
            ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
            : scanStatus === 'error'
            ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
            : 'border-border bg-surface/50'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {scanStatus === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : scanStatus === 'error' ? (
              <XCircle className="w-5 h-5 text-red-500" />
            ) : (
              <Scan className="w-5 h-5 text-primary" />
            )}
            <span className={`text-sm font-semibold ${
              scanStatus === 'ok' ? 'text-green-700 dark:text-green-300'
              : scanStatus === 'error' ? 'text-red-700 dark:text-red-300'
              : 'text-text'
            }`}>
              {scanStatus === 'ok'
                ? t('kiosk.equip.scanOk')
                : scanStatus === 'error'
                ? t('kiosk.equip.scanError')
                : t('kiosk.equip.scanHint')}
            </span>
          </div>
          <input
            ref={scanRef}
            type="text"
            value={scanValue}
            onChange={e => { setScanValue(e.target.value); setScanStatus('idle'); }}
            onKeyDown={handleScanKeyDown}
            placeholder={t('kiosk.equip.scanPlaceholder')}
            disabled={scanStatus !== 'idle'}
            className={`w-full h-12 px-4 text-lg font-mono font-bold border-2 rounded-lg focus:outline-none transition-colors ${
              scanStatus === 'ok'
                ? 'border-green-400 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : scanStatus === 'error'
                ? 'border-red-400 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'border-border bg-background focus:border-primary'
            }`}
          />
          <p className="text-xs text-text-muted mt-2">
            {t('kiosk.equip.scanSubHint')}
          </p>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-muted px-1">{t('kiosk.equip.orManual')}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* 수동 선택 — 검색 + 목록 */}
        <div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('kiosk.equip.searchPlaceholder')}
              className="w-full h-9 pl-9 pr-3 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-text-muted">
              {t('kiosk.equip.noResult')}
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-border/40 border border-border rounded-lg">
              {filtered.map(equip => (
                <li key={equip.equipCode}>
                  <button
                    onClick={() => { onSelect(equip); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <Cpu className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                        {equip.equipName}
                      </p>
                      <p className="text-xs text-text-muted font-mono">{equip.equipCode}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
