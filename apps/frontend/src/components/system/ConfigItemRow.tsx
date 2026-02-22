'use client';

/**
 * @file components/system/ConfigItemRow.tsx
 * @description 환경설정 개별 항목 행 - 타입별 입력 UI (토글/선택/숫자/텍스트)
 *
 * 초보자 가이드:
 * 1. BOOLEAN: 토글 스위치 (Y/N)
 * 2. SELECT: 드롭다운 (options JSON 파싱)
 * 3. NUMBER: 숫자 입력 필드
 * 4. TEXT: 텍스트 입력 필드
 * 5. 변경된 항목은 좌측 파란 보더로 강조
 */
import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Input, Select } from '@/components/ui';
import type { SysConfigItem } from '@/stores/sysConfigStore';

interface Props {
  config: SysConfigItem;
  currentValue: string;
  isChanged: boolean;
  onValueChange: (value: string) => void;
  onDelete: () => void;
}

export default function ConfigItemRow({ config, currentValue, isChanged, onValueChange, onDelete }: Props) {
  const selectOptions = useMemo(() => {
    if (config.configType !== 'SELECT' || !config.options) return [];
    try {
      return JSON.parse(config.options) as { value: string; label: string }[];
    } catch {
      return [];
    }
  }, [config.configType, config.options]);

  return (
    <div
      className={`flex items-center gap-4 py-3 px-3 rounded transition-colors ${
        isChanged
          ? 'border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10'
          : 'border-l-4 border-l-transparent'
      }`}
    >
      {/* 라벨 + 설명 */}
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium text-sm text-text">{config.label}</div>
        {config.description && (
          <div className="text-xs text-text-muted mt-0.5">{config.description}</div>
        )}
        <div className="text-xs text-text-muted/60 mt-0.5 font-mono">{config.configKey}</div>
      </div>

      {/* 입력 UI */}
      <div className="w-64 flex-shrink-0">
        {config.configType === 'BOOLEAN' && (
          <button
            type="button"
            onClick={() => onValueChange(currentValue === 'Y' ? 'N' : 'Y')}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              currentValue === 'Y'
                ? 'bg-primary'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                currentValue === 'Y' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
            <span className="sr-only">{config.label}</span>
          </button>
        )}

        {config.configType === 'SELECT' && (
          <Select
            options={selectOptions}
            value={currentValue}
            onChange={onValueChange}
            fullWidth
          />
        )}

        {config.configType === 'NUMBER' && (
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => onValueChange(e.target.value)}
            fullWidth
          />
        )}

        {config.configType === 'TEXT' && (
          <Input
            value={currentValue}
            onChange={(e) => onValueChange(e.target.value)}
            fullWidth
          />
        )}
      </div>

      {/* 삭제 버튼 */}
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        title="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
