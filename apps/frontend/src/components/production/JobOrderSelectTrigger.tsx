"use client";

/**
 * @file components/production/JobOrderSelectTrigger.tsx
 * @description 작업지시 선택 트리거(공용) — 실적입력 3화면(가공·서브조립·조립)이 같은 모양으로 쓴다.
 *
 * 초보자 가이드:
 * 1. 가공 키오스크 헤더(EquipHeader)의 작업지시 칸을 그대로 공용화한 것이다(2026-09-19 지시: 세 화면 통일).
 *    선택 전에는 "작업지시를 선택하세요" 버튼(설비 없으면 비활성), 선택 후에는 지시번호·품목명과 "변경" 버튼.
 * 2. 실제 조회·스캔은 공용 JobOrderSelectModal이 한다. 이 컴포넌트는 그 모달을 여는 onOpen만 부른다.
 *    헤더에 별도 스캔칸을 두면 화면마다 입력 경로가 갈라지므로 두지 않는다.
 * 3. 2xl 미만은 아이콘만, 2xl 이상은 라벨까지 — 키오스크 Row1 축약 규칙과 같다.
 */
import { useTranslation } from "react-i18next";
import { ClipboardList, Pencil, Search } from "lucide-react";

interface JobOrderSelectTriggerProps {
  orderNo?: string | null;
  itemName?: string | null;
  /** 지시 유형 배지(공정지시 등). 없으면 표시하지 않는다 */
  processType?: string | null;
  /** 설비가 선택돼야 작업지시를 고를 수 있다 */
  hasEquip: boolean;
  /** 발행·확정 중 등 문맥 잠금 */
  disabled?: boolean;
  onOpen: () => void;
  testId?: string;
  className?: string;
}

export default function JobOrderSelectTrigger({
  orderNo,
  itemName,
  processType,
  hasEquip,
  disabled = false,
  onOpen,
  testId = "kiosk-joborder-open",
  className = "",
}: JobOrderSelectTriggerProps) {
  const { t } = useTranslation();
  const canOpen = hasEquip && !disabled;

  return (
    <div className={`flex h-11 min-w-[9rem] 2xl:min-w-[15rem] items-center gap-2 overflow-hidden rounded-lg border border-border bg-card px-3 ${className}`}>
      <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
      {orderNo ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-mono text-sm font-bold text-black dark:text-white">{orderNo}</span>
          {processType && (
            <span className="hidden shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary 2xl:inline">{processType}</span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-black/60 dark:text-white/60">{itemName ?? ""}</span>
          <button
            type="button"
            data-testid={testId}
            onClick={onOpen}
            disabled={disabled}
            title={t("common.change", "변경")}
            aria-label={t("common.change", "변경")}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-black/60 dark:disabled:text-white/60 2xl:h-auto 2xl:w-auto 2xl:px-2.5 2xl:py-1"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0 2xl:hidden" />
            <span className="hidden 2xl:inline">{t("common.change", "변경")}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid={testId}
          onClick={() => canOpen && onOpen()}
          disabled={!canOpen}
          title={hasEquip ? t("kiosk.header.selectJobOrder", "작업지시를 선택하세요") : t("kiosk.header.selectEquipFirst", "설비를 먼저 선택하세요.")}
          aria-label={t("kiosk.header.selectJobOrder", "작업지시를 선택하세요")}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center whitespace-nowrap rounded bg-primary text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-black/60 dark:disabled:text-white/60 2xl:h-auto 2xl:w-auto 2xl:px-2.5 2xl:py-1 ${canOpen ? "animate-pulse" : ""}`}
        >
          <Search className="h-3.5 w-3.5 shrink-0 2xl:hidden" />
          <span className="hidden 2xl:inline">{t("kiosk.header.selectJobOrder", "작업지시를 선택하세요")}</span>
        </button>
      )}
    </div>
  );
}
