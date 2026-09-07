"use client";

/**
 * @file src/app/(authenticated)/monitoring/spc-board/components/SpcMonitorSettingsModal.tsx
 * @description SPC 관리도 보드 전용 설정 모달 — 관리항목/설비 체크리스트 2개 + 재조회·롤링 주기.
 *
 * 초보자 가이드:
 * - 공통 MonitoringSettingsModal은 대상 목록 1개만 지원해서(다른 5개 보드는 "설비"만 고름),
 *   이 보드는 관리항목+설비 2개를 동시에 골라야 해서 전용 모달을 새로 만들었다.
 * - 선택 안 하면(빈 배열) "전체"로 동작 — 다른 보드와 동일한 관례.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { Modal, Button, Input, Select } from "@/components/ui";

export interface SpcMonitorOption {
  code: string;
  label: string;
  sub?: string;
}

export interface SpcMonitorSettings {
  targetCodes: string[];
  equipCodes: string[];
  refetchSec: number;
  rollingSec: number;
}

export const DEFAULT_SPC_MONITOR_SETTINGS: SpcMonitorSettings = {
  targetCodes: [],
  equipCodes: [],
  refetchSec: 30,
  rollingSec: 10,
};

const REFETCH_OPTIONS = [15, 30, 60, 120, 300];
const ROLLING_OPTIONS = [8, 10, 15, 20, 30, 60];
const secLabel = (s: number) => (s >= 60 ? `${s / 60}분` : `${s}초`);

/** localStorage 영속 훅 — useMonitoringConfig 와 동일한 패턴, 이 보드 전용 형태(targetCodes+equipCodes)라 별도로 둔다 */
export function useSpcMonitorSettings(storageKey: string) {
  const [settings, setSettingsState] = useState<SpcMonitorSettings>(DEFAULT_SPC_MONITOR_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSettingsState({ ...DEFAULT_SPC_MONITOR_SETTINGS, ...JSON.parse(raw) });
    } catch {
      // 손상된 값은 기본값으로 무시
    }
    setLoaded(true);
  }, [storageKey]);

  const setSettings = useCallback((s: SpcMonitorSettings) => {
    setSettingsState(s);
    try { localStorage.setItem(storageKey, JSON.stringify(s)); } catch {
      // 저장 실패는 무시(시크릿 모드 등)
    }
  }, [storageKey]);

  return { settings, setSettings, loaded };
}

interface ChecklistProps {
  label: string;
  options: SpcMonitorOption[];
  selected: string[];
  onChange: (codes: string[]) => void;
}

function Checklist({ label, options, selected, onChange }: ChecklistProps) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (code: string) => {
    onChange(selectedSet.has(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedSet.has(o.code));
  const toggleAllFiltered = () => {
    const next = new Set(selected);
    if (allFilteredSelected) filtered.forEach((o) => next.delete(o.code));
    else filtered.forEach((o) => next.add(o.code));
    onChange([...next]);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
        <span className="text-sm font-semibold text-text shrink-0">{label} 선택</span>
        <span className="text-xs text-text-muted shrink-0">{selected.length > 0 ? `${selected.length}개 선택` : "전체"}</span>
        <div className="flex-1" />
        <button type="button" onClick={toggleAllFiltered} className="text-xs text-primary hover:underline shrink-0">
          {allFilteredSelected ? "현재 목록 해제" : "현재 목록 전체"}
        </button>
        <button type="button" onClick={() => onChange([])} className="text-xs text-text-muted hover:underline shrink-0">
          전체 해제
        </button>
      </div>
      <div className="px-3 py-2 border-b border-border">
        <Input placeholder={`${label} 검색...`} value={query} onChange={(e) => setQuery(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
      </div>
      <div className="max-h-[32vh] overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted">검색 결과가 없습니다.</div>
        ) : (
          filtered.map((o) => (
            <label key={o.code} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface">
              <input type="checkbox" checked={selectedSet.has(o.code)} onChange={() => toggle(o.code)} className="w-4 h-4 accent-primary shrink-0" />
              <span className="font-mono text-xs text-text-muted shrink-0 w-32 truncate">{o.code}</span>
              <span className="text-sm text-text truncate flex-1">{o.label}</span>
              {o.sub && <span className="text-xs text-text-muted shrink-0">{o.sub}</span>}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetOptions: SpcMonitorOption[];
  equipOptions: SpcMonitorOption[];
  value: SpcMonitorSettings;
  onSave: (settings: SpcMonitorSettings) => void;
}

export default function SpcMonitorSettingsModal({ isOpen, onClose, targetOptions, equipOptions, value, onSave }: Props) {
  const [draft, setDraft] = useState<SpcMonitorSettings>(value);

  useEffect(() => {
    if (isOpen) setDraft(value);
  }, [isOpen, value]);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="관리도 모니터링 설정" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
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
        </div>

        <Checklist label="관리항목" options={targetOptions} selected={draft.targetCodes} onChange={(codes) => setDraft((d) => ({ ...d, targetCodes: codes }))} />
        <Checklist label="설비" options={equipOptions} selected={draft.equipCodes} onChange={(codes) => setDraft((d) => ({ ...d, equipCodes: codes }))} />
      </div>

      <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onClose}>취소</Button>
        <Button size="sm" onClick={handleSave}>저장</Button>
      </div>
    </Modal>
  );
}
