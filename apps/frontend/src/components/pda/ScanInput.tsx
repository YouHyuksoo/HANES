"use client";

/**
 * @file src/components/pda/ScanInput.tsx
 * @description PDA 전용 바코드 스캔 입력 컴포넌트 (Layer 2)
 *
 * 초보자 가이드:
 * 1. **마운트 트릭** (SMMEX 패턴 그대로):
 *    inputMode="text"로 focus → Input Connection 생성 + 키보드 표시
 *    → 300ms 후 inputMode="none" → 키보드만 사라지고 스캐너 연결 유지
 * 2. **VirtualKeyboard API**: 지원 시 강제 숨김
 * 3. **키보드 토글**: blur → mode 전환 → 50ms → re-focus
 * 4. **Enter 키**: onScan 호출 → 입력 클리어 → 키보드 숨김 트릭 재적용
 *
 * 참조: C:\Project\SMMEX_SMT_PDA\src\components\ui\scan-input.tsx
 */
import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Keyboard, KeyboardOff } from "lucide-react";
import { usePdaStore } from "@/stores/pdaStore";

interface ScanInputProps {
  /** 스캔 완료 시 호출 */
  onScan: (value: string) => void;
  /** placeholder i18n 키 (기본: pda.scan.placeholder) */
  placeholderKey?: string;
  /** 비활성화 */
  disabled?: boolean;
  /** 외부에서 값 제어 */
  value?: string;
  /** 외부에서 값 변경 */
  onChange?: (value: string) => void;
  /** 스캔 후 자동 클리어 (기본 true) */
  autoClear?: boolean;
  /** 로딩 상태 */
  isLoading?: boolean;
}

export default function ScanInput({
  onScan,
  placeholderKey = "pda.scan.placeholder",
  disabled = false,
  value: externalValue,
  onChange: externalOnChange,
  autoClear = true,
  isLoading = false,
}: ScanInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { keyboardVisible, toggleKeyboard } = usePdaStore();
  const [internalValue, setInternalValue] = useState("");

  const value = externalValue !== undefined ? externalValue : internalValue;
  const setValue = useCallback(
    (v: string) => {
      if (externalOnChange) externalOnChange(v);
      else setInternalValue(v);
    },
    [externalOnChange],
  );

  /**
   * 핵심 트릭 (SMMEX scan-input.tsx 패턴):
   * Phase 1: inputMode="text" + focus → OS가 Input Connection 생성 + 키보드 표시
   * Phase 2: 300ms 후 inputMode="none" → 키보드만 사라지고 Input Connection 유지
   *
   * 이 연결이 살아있으면 하드웨어 스캐너의 keypress가 input에 정상 전달됨
   */
  const applyHideKeyboardTrick = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    // Phase 1
    input.setAttribute("inputmode", "text");
    input.focus();

    // Phase 2
    const timer = setTimeout(() => {
      input.setAttribute("inputmode", "none");
      // VirtualKeyboard API 지원 시 강제 숨김
      try {
        if ("virtualKeyboard" in navigator) {
          const vk = (navigator as unknown as {
            virtualKeyboard: { overlaysContent: boolean; hide: () => void };
          }).virtualKeyboard;
          vk.overlaysContent = true;
          vk.hide();
        }
      } catch {
        /* 미지원 환경 무시 */
      }
    }, 300);

    return timer;
  }, []);

  // ── 마운트 시 키보드 숨김 트릭 적용 ──
  useEffect(() => {
    if (disabled) return;

    if (keyboardVisible) {
      // 키보드 보이기 모드: 그냥 focus
      const timer = setTimeout(() => {
        inputRef.current?.setAttribute("inputmode", "text");
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }

    // 키보드 숨김 모드: 트릭 적용
    const timer = setTimeout(() => {
      applyHideKeyboardTrick();
    }, 100);
    return () => clearTimeout(timer);
    // 마운트 시 1회 + disabled 변경 시에만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  // ── 키보드 토글 시 모드 전환 (SMMEX ScanInputs.tsx 패턴) ──
  const handleToggleKeyboard = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      toggleKeyboard();
      return;
    }

    // blur → 모드 전환 → re-focus (키보드 상태 동기화)
    input.blur();

    toggleKeyboard();

    setTimeout(() => {
      const nextVisible = !keyboardVisible;
      if (nextVisible) {
        // 키보드 보이기
        input.setAttribute("inputmode", "text");
        input.focus();
      } else {
        // 키보드 숨기기 트릭
        applyHideKeyboardTrick();
      }
    }, 50);
  }, [keyboardVisible, toggleKeyboard, applyHideKeyboardTrick]);

  // ── Enter 키 처리 ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      onScan(value.trim());
      if (autoClear) {
        setValue("");
      }
      // 스캔 후 키보드 숨김 상태 유지하면서 포커스 복원
      setTimeout(() => {
        if (keyboardVisible) {
          inputRef.current?.focus();
        } else {
          applyHideKeyboardTrick();
        }
      }, 50);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="relative flex items-center gap-2">
        {/* 스캔 아이콘 */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-slate-400" />
          )}
        </div>

        {/* 입력 필드 - 초기 inputMode="text" (마운트 트릭이 300ms 후 "none"으로 전환) */}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t(placeholderKey)}
          disabled={disabled}
          className="w-full h-14 pl-11 pr-12 text-lg font-mono bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
        />

        {/* 키보드 토글 */}
        <button
          type="button"
          onClick={handleToggleKeyboard}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 transition-colors"
          aria-label={t("pda.scan.toggleKeyboard")}
        >
          {keyboardVisible ? (
            <KeyboardOff className="w-5 h-5" />
          ) : (
            <Keyboard className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
