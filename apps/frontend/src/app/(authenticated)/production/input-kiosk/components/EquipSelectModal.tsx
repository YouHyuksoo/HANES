"use client";

/**
 * @file components/EquipSelectModal.tsx
 * @description 설비 선택 모달 — 바코드 스캔 또는 목록에서 수동 선택
 *
 * 초보자 가이드:
 * - 바코드 스캔: 모달 열리면 스캔 입력창 자동 포커스 → Enter 시 equipCode 매칭
 * - 수동 선택: 라인(저전압/고전압/공통) → 공정별로 그룹지어 멀티컬럼 표시
 * - 스캔 성공/실패 시 시각적 피드백 표시
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Scan, Search, Cpu, CheckCircle2, XCircle } from 'lucide-react';
import { Modal, ComCodeBadge } from '@/components/ui';
import { BarcodeScanInput } from '@/components/shared';
import { useComCodeList } from '@/hooks/useComCode';

interface EquipOption { equipCode: string; equipName: string; processCode?: string; processName?: string; lineType?: string; }

interface EquipSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  equips: EquipOption[];
  onSelect: (equip: EquipOption) => void;
}

type ScanStatus = 'idle' | 'ok' | 'error';

interface ProcessGroup {
  key: string;
  processName: string;
  items: EquipOption[];
}

interface LineGroup {
  lineType: string; // 'LV' | 'HV' | 'CM' | '__NONE__'
  processGroups: ProcessGroup[];
  count: number;
}

const NO_LINE = '__NONE__';

export default function EquipSelectModal({ isOpen, onClose, equips, onSelect }: EquipSelectModalProps) {
  const { t } = useTranslation();
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState('');
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const lineCodes = useComCodeList('LINE_TYPE');

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

  const noProcessLabel = t('kiosk.equip.noProcess', { defaultValue: '공정 미지정' });
  const noLineLabel = t('kiosk.equip.noLine', { defaultValue: '라인 미지정' });

  // 검색 필터 → 라인별 → 공정별 2단계 그룹화
  const lineGroups = useMemo<LineGroup[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? equips.filter(e =>
          e.equipCode.toLowerCase().includes(q) ||
          e.equipName.toLowerCase().includes(q) ||
          (e.processName?.toLowerCase().includes(q) ?? false) ||
          (e.processCode?.toLowerCase().includes(q) ?? false),
        )
      : equips;

    // 라인 정렬 순서 (공통코드 SORT_ORDER 기준)
    const lineOrder = new Map<string, number>();
    lineCodes.forEach((c, i) => lineOrder.set(c.detailCode, i));

    const lineMap = new Map<string, Map<string, ProcessGroup>>();
    for (const e of filtered) {
      const lt = e.lineType || NO_LINE;
      let pmap = lineMap.get(lt);
      if (!pmap) { pmap = new Map(); lineMap.set(lt, pmap); }
      const pkey = e.processCode || '__NOPROC__';
      let group = pmap.get(pkey);
      if (!group) {
        group = { key: pkey, processName: e.processName || (e.processCode ?? noProcessLabel), items: [] };
        pmap.set(pkey, group);
      }
      group.items.push(e);
    }

    const result: LineGroup[] = [...lineMap.entries()].map(([lt, pmap]) => {
      const processGroups = [...pmap.values()];
      processGroups.forEach(g => g.items.sort((a, b) => a.equipName.localeCompare(b.equipName, 'ko')));
      processGroups.sort((a, b) => a.processName.localeCompare(b.processName, 'ko'));
      return { lineType: lt, processGroups, count: processGroups.reduce((s, g) => s + g.items.length, 0) };
    });
    result.sort((a, b) => {
      const oa = lineOrder.has(a.lineType) ? (lineOrder.get(a.lineType) as number) : 999;
      const ob = lineOrder.has(b.lineType) ? (lineOrder.get(b.lineType) as number) : 999;
      return oa - ob;
    });
    return result;
  }, [equips, searchQuery, noProcessLabel, lineCodes]);

  const totalCount = useMemo(() => lineGroups.reduce((s, l) => s + l.count, 0), [lineGroups]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.equip.modalTitle')} size="full">
      <div className="flex flex-col gap-3">

        {/* 스캔 + 검색 — 한 줄로 압축 (세로 공간 확보) */}
        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <div className={`flex-1 rounded-lg border-2 px-3 py-2 flex items-center gap-3 transition-colors ${
            scanStatus === 'ok'
              ? 'border-green-400'
              : scanStatus === 'error'
              ? 'border-red-400'
              : 'border-border bg-surface/50'
          }`}>
            <div className="flex items-center gap-2 shrink-0">
              {scanStatus === 'ok' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : scanStatus === 'error' ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : (
                <Scan className="w-5 h-5 text-primary" />
              )}
              <span className={`text-xs font-semibold hidden md:inline ${
                scanStatus === 'ok' ? 'text-green-600 dark:text-green-300'
                : scanStatus === 'error' ? 'text-red-600 dark:text-red-300'
                : 'text-text-muted'
              }`}>
                {scanStatus === 'ok'
                  ? t('kiosk.equip.scanOk')
                  : scanStatus === 'error'
                  ? t('kiosk.equip.scanError')
                  : t('kiosk.equip.scanHint')}
              </span>
            </div>
            <BarcodeScanInput
              ref={scanRef}
              value={scanValue}
              onChange={(value) => { setScanValue(value); setScanStatus('idle'); }}
              onScan={handleScanSelect}
              placeholder={t('kiosk.equip.scanPlaceholder')}
              disabled={scanStatus !== 'idle'}
              maintainFocus={isOpen}
              className={`flex-1 min-w-0 h-11 px-3 text-base font-mono font-bold border-2 rounded-lg focus:outline-none transition-colors ${
                scanStatus === 'ok'
                  ? 'border-green-400 text-green-700 dark:text-green-300'
                  : scanStatus === 'error'
                  ? 'border-red-400 text-red-700 dark:text-red-300'
                  : 'border-border bg-background focus:border-primary'
              }`}
            />
          </div>

          <div className="relative sm:w-72 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('kiosk.equip.searchPlaceholder')}
              className="w-full h-full min-h-11 pl-9 pr-3 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* 라인 → 공정 그룹 */}
        {lineGroups.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-muted">
            {t('kiosk.equip.noResult')}
          </div>
        ) : (
          <div className="space-y-4">
            {lineGroups.map(line => (
              <div key={line.lineType}>
                {/* 라인 섹션 헤더 */}
                <div className="flex items-center gap-2 mb-2">
                  {line.lineType !== NO_LINE ? (
                    <ComCodeBadge groupCode="LINE_TYPE" code={line.lineType} />
                  ) : (
                    <span className="text-sm font-bold text-text-muted">{noLineLabel}</span>
                  )}
                  <span className="text-[11px] font-mono text-text-muted">{line.count}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {/* 공정별 카드 멀티컬럼 */}
                <div className="columns-2 md:columns-3 xl:columns-4 2xl:columns-5 gap-3 [column-fill:_balance]">
                  {line.processGroups.map(group => (
                    <div key={group.key} className="break-inside-avoid mb-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-surface/60 rounded-t-lg">
                        <span className="text-sm font-bold text-text truncate">{group.processName}</span>
                        <span className="text-[11px] font-mono text-text-muted shrink-0">{group.items.length}</span>
                      </div>
                      <div className="p-1.5 space-y-1">
                        {group.items.map(equip => (
                          <button
                            key={equip.equipCode}
                            onClick={() => { onSelect(equip); onClose(); }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-transparent hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                          >
                            <Cpu className="w-4 h-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">
                                {equip.equipName}
                              </p>
                              <p className="text-[11px] text-text-muted font-mono truncate">{equip.equipCode}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 하단 요약 */}
        <p className="text-xs text-text-muted text-right flex-shrink-0">
          {t('kiosk.equip.scanSubHint')} · {totalCount}
        </p>
      </div>
    </Modal>
  );
}
