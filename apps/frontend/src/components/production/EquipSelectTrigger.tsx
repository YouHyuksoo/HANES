"use client";

/**
 * @file components/production/EquipSelectTrigger.tsx
 * @description 설비 선택 트리거(공용) — 실적입력 3화면(가공·서브조립·조립)이 같은 모양으로 쓴다.
 *
 * 초보자 가이드:
 * 1. 가공 키오스크 헤더(EquipHeader)의 설비 칸을 그대로 공용화한 것이다(2026-09-19 지시: 세 화면 통일).
 *    미선택이면 점선 테두리 + 깜빡임, 선택되면 설비명/코드·공정명. 폭은 w-52 고정.
 * 2. 실제 목록·바코드 스캔은 공용 EquipSelectModal이 한다. 이 컴포넌트는 그 모달을 여는 onOpen만 부른다.
 */
import { useTranslation } from "react-i18next";
import { ChevronDown, Cpu } from "lucide-react";

interface EquipSelectTriggerProps {
  equipCode?: string | null;
  equipName?: string | null;
  processCode?: string | null;
  processName?: string | null;
  /** 발행·확정 중 등 문맥 잠금 */
  disabled?: boolean;
  onOpen: () => void;
  testId?: string;
  className?: string;
}

export default function EquipSelectTrigger({
  equipCode,
  equipName,
  processCode,
  processName,
  disabled = false,
  onOpen,
  testId = "kiosk-equip-open",
  className = "",
}: EquipSelectTriggerProps) {
  const { t } = useTranslation();
  const selected = !!equipCode;

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onOpen}
      disabled={disabled}
      className={`flex h-11 w-52 shrink-0 items-center gap-2 rounded-lg border-2 px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
          : "border-dashed border-border hover:border-primary animate-pulse"
      } ${className}`}
    >
      <Cpu className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        {selected ? (
          <>
            <div className="truncate text-sm font-extrabold text-black dark:text-white">{equipName ?? equipCode}</div>
            <div className="truncate text-[11px] text-black/60 dark:text-white/60">
              {equipCode}
              {processCode && (
                <span className="ml-1 font-semibold text-primary">· {processName || processCode}</span>
              )}
            </div>
          </>
        ) : (
          <span className="text-sm font-semibold text-black/60 dark:text-white/60">{t("kiosk.header.selectEquip", "설비 선택")}</span>
        )}
      </div>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </button>
  );
}
