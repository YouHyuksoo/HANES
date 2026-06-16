"use client";

/**
 * @file src/components/monitoring/MonitoringSettingsModal.tsx
 * @description 모니터링 설정 모달 — 대상 다중선택 + 재조회/롤링 인터벌 + 그리드(열·행)
 *
 * 초보자 가이드:
 * - options: 모니터링 대상 후보(설비 등). 체크한 항목만 selectedCodes 에 담긴다.
 * - 아무것도 선택하지 않으면 "전체"로 동작한다(빈 배열 = 전체).
 * - 저장(onSave) 시 부모가 localStorage 등에 영속화한다.
 */
import { useState, useEffect, useMemo } from "react";
import { Search, Settings2 } from "lucide-react";
import { Modal, Button, Input, Select } from "@/components/ui";
import type { MonitoringConfig } from "./useMonitoringConfig";

export interface MonitoringTargetOption {
  code: string;
  label: string;
  sub?: string;
}

interface MonitoringSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 대상 종류 라벨 (예: "설비") */
  targetLabel: string;
  options: MonitoringTargetOption[];
  value: MonitoringConfig;
  onSave: (cfg: MonitoringConfig) => void;
  /** 그리드(열·행) 설정 노출 여부 */
  showGrid?: boolean;
}

const REFETCH_OPTIONS = [10, 15, 30, 60, 120, 300];
const ROLLING_OPTIONS = [5, 8, 10, 15, 20, 30];
const COLUMN_OPTIONS = [3, 4, 5, 6, 7];
const ROW_OPTIONS = [2, 3, 4, 5, 6];

const secLabel = (s: number) => (s >= 60 ? `${s / 60}분` : `${s}초`);

export default function MonitoringSettingsModal({
  isOpen, onClose, targetLabel, options, value, onSave, showGrid = true,
}: MonitoringSettingsModalProps) {
  const [draft, setDraft] = useState<MonitoringConfig>(value);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDraft(value);
      setQuery("");
    }
  }, [isOpen, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(draft.selectedCodes), [draft.selectedCodes]);

  const toggle = (code: string) => {
    setDraft((d) => ({
      ...d,
      selectedCodes: d.selectedCodes.includes(code)
        ? d.selectedCodes.filter((c) => c !== code)
        : [...d.selectedCodes, code],
    }));
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedSet.has(o.code));
  const toggleAllFiltered = () => {
    setDraft((d) => {
      const next = new Set(d.selectedCodes);
      if (allFilteredSelected) filtered.forEach((o) => next.delete(o.code));
      else filtered.forEach((o) => next.add(o.code));
      return { ...d, selectedCodes: [...next] };
    });
  };

  const clearAll = () => setDraft((d) => ({ ...d, selectedCodes: [] }));

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="모니터링 설정" size="xl">
      <div className="space-y-4">
        {/* 인터벌 / 그리드 설정 */}
        <div className={`grid gap-3 ${showGrid ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
          <Select
            label="재조회 주기"
            value={String(draft.refetchSec)}
            onChange={(v) => setDraft((d) => ({ ...d, refetchSec: Number(v) }))}
            options={REFETCH_OPTIONS.map((s) => ({ value: String(s), label: secLabel(s) }))}
            fullWidth
          />
          <Select
            label="롤링 주기"
            value={String(draft.rollingSec)}
            onChange={(v) => setDraft((d) => ({ ...d, rollingSec: Number(v) }))}
            options={ROLLING_OPTIONS.map((s) => ({ value: String(s), label: secLabel(s) }))}
            fullWidth
          />
          {showGrid && (
            <>
              <Select
                label="열 수"
                value={String(draft.columns)}
                onChange={(v) => setDraft((d) => ({ ...d, columns: Number(v) }))}
                options={COLUMN_OPTIONS.map((n) => ({ value: String(n), label: `${n}열` }))}
                fullWidth
              />
              <Select
                label="행 수"
                value={String(draft.rows)}
                onChange={(v) => setDraft((d) => ({ ...d, rows: Number(v) }))}
                options={ROW_OPTIONS.map((n) => ({ value: String(n), label: `${n}행` }))}
                fullWidth
              />
            </>
          )}
        </div>

        {/* 대상 선택 */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
            <span className="text-sm font-semibold text-text shrink-0">{targetLabel} 선택</span>
            <span className="text-xs text-text-muted shrink-0">
              {draft.selectedCodes.length > 0 ? `${draft.selectedCodes.length}개 선택` : "전체"}
            </span>
            <div className="flex-1" />
            <button type="button" onClick={toggleAllFiltered}
              className="text-xs text-primary hover:underline shrink-0">
              {allFilteredSelected ? "현재 목록 해제" : "현재 목록 전체"}
            </button>
            <button type="button" onClick={clearAll}
              className="text-xs text-text-muted hover:underline shrink-0">
              전체 해제
            </button>
          </div>

          <div className="px-3 py-2 border-b border-border">
            <Input
              placeholder={`${targetLabel} 검색...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>

          <div className="max-h-[40vh] overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">검색 결과가 없습니다.</div>
            ) : (
              filtered.map((o) => {
                const checked = selectedSet.has(o.code);
                return (
                  <label key={o.code}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.code)}
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <span className="font-mono text-xs text-text-muted shrink-0 w-28 truncate">{o.code}</span>
                    <span className="text-sm text-text truncate flex-1">{o.label}</span>
                    {o.sub && <span className="text-xs text-text-muted shrink-0">{o.sub}</span>}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <p className="text-[11px] text-text-muted flex items-center gap-1">
          <Settings2 className="w-3 h-3" />
          선택하지 않으면 전체 {targetLabel}가 표시됩니다.
        </p>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </div>
    </Modal>
  );
}
