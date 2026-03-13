"use client";

/**
 * @file src/components/pda/ReasonCodeSelect.tsx
 * @description PDA 전용 사유 코드 선택 컴포넌트
 *
 * 초보자 가이드:
 * 1. comCodeType으로 DB 공통코드 그룹을 지정하면 옵션이 자동으로 로드됩니다.
 *    예) 'ADJ_REASON' → 조정 사유 목록, 'INSPECT_NG_REASON' → 검사 불합격 사유
 * 2. 선택한 코드값이 'ETC' 또는 '기타'면 직접입력 텍스트 필드가 나타납니다.
 * 3. 직접입력 시 onChange(code='ETC', text='입력내용') 형태로 콜백이 호출됩니다.
 * 4. PDA 터치 친화적 크기로 설계됐습니다 (h-14, text-base).
 */

import { useState, useId } from "react";
import { useComCodeOptions } from "@/hooks/useComCode";
import { ChevronDown } from "lucide-react";

/** ETC 코드로 간주하는 detailCode 목록 */
const ETC_CODES = ["ETC", "기타", "etc", "OTHER"];

/**
 * ReasonCodeSelect Props
 */
interface ReasonCodeSelectProps {
  /** ComCode 그룹 코드 (예: 'ADJ_REASON', 'INSPECT_NG_REASON') */
  comCodeType: string;
  /** 현재 선택된 코드값 */
  value: string;
  /**
   * 변경 콜백
   * @param code - 선택된 detailCode ('ETC' 포함)
   * @param text - '기타' 선택 시 직접입력 텍스트 (일반 선택 시 undefined)
   */
  onChange: (code: string, text?: string) => void;
  /** 드롭다운 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 필수 입력 여부 */
  required?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 레이블 텍스트 (없으면 레이블 미렌더링) */
  label?: string;
  /** 비활성화 */
  disabled?: boolean;
}

/**
 * PDA 사유 코드 선택 컴포넌트
 *
 * @example
 * <ReasonCodeSelect
 *   comCodeType="ADJ_REASON"
 *   value={reason}
 *   onChange={(code, text) => setReason({ code, text })}
 *   placeholder="사유 선택"
 *   label="조정 사유"
 *   required
 * />
 */
export default function ReasonCodeSelect({
  comCodeType,
  value,
  onChange,
  placeholder = "사유를 선택하세요",
  required = false,
  className = "",
  label,
  disabled = false,
}: ReasonCodeSelectProps) {
  const uid = useId();
  const options = useComCodeOptions(comCodeType);
  const [etcText, setEtcText] = useState("");

  /** 현재 선택값이 ETC(기타)인지 판단 */
  const isEtc = ETC_CODES.includes(value);

  /** select 변경 핸들러 */
  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    const isEtcCode = ETC_CODES.includes(code);

    if (isEtcCode) {
      // ETC 선택 시 직접입력 초기화 후 콜백
      setEtcText("");
      onChange(code, "");
    } else {
      onChange(code, undefined);
    }
  }

  /** 직접입력 변경 핸들러 */
  function handleEtcTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setEtcText(text);
    onChange(value, text);
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* 레이블 */}
      {label && (
        <label
          htmlFor={uid}
          className="text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          {label}
          {required && (
            <span className="ml-1 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* 드롭다운 */}
      <div className="relative">
        <select
          id={uid}
          value={value}
          onChange={handleSelectChange}
          disabled={disabled}
          required={required}
          className={[
            "w-full h-14 px-4 pr-10 text-base rounded-xl appearance-none",
            "bg-white dark:bg-slate-800",
            "border-2 border-slate-300 dark:border-slate-600",
            "text-slate-900 dark:text-white",
            "focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none",
            "transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-700",
            !value ? "text-slate-400 dark:text-slate-500" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* 기본 플레이스홀더 옵션 */}
          <option value="" disabled>
            {placeholder}
          </option>

          {/* ComCode 옵션 목록 */}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 드롭다운 화살표 아이콘 */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>

      {/* 기타(ETC) 직접입력 필드 */}
      {isEtc && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${uid}-etc`}
            className="text-sm font-semibold text-slate-600 dark:text-slate-300"
          >
            직접 입력
            {required && (
              <span className="ml-1 text-red-500" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <input
            id={`${uid}-etc`}
            type="text"
            value={etcText}
            onChange={handleEtcTextChange}
            disabled={disabled}
            placeholder="사유를 직접 입력하세요"
            required={required}
            className={[
              "w-full h-14 px-4 text-base rounded-xl",
              "bg-white dark:bg-slate-800",
              "border-2 border-amber-400 dark:border-amber-500",
              "text-slate-900 dark:text-white",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
              "focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none",
              "transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          />
        </div>
      )}
    </div>
  );
}
