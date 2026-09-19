"use client";
/**
 * @file components/shared/carrier/OutputCarrierSlot.tsx
 * @description 출력 대차 슬롯 — 대차 스캔칸, 현재 대차·적재수/수용량·상태, 이동전표 버튼. 상태는 useOutputCarrier가 소유.
 *              세 화면(가공·서브조립·조립) 헤더가 같은 컴포넌트를 쓴다. 파스텔 배경 없이 테두리·텍스트로 상태 구분.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileOutput, ShoppingCart, X } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import CarrierSlipPrintModal from "./CarrierSlipPrintModal";
import type { OutputCarrierState } from "./useOutputCarrier";

interface Props {
  state: OutputCarrierState;
  /** 2xl 미만에서 라벨을 숨기는 헤더용 축약 */
  compact?: boolean;
}

export default function OutputCarrierSlot({ state, compact = false }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [slipOpen, setSlipOpen] = useState(false);
  if (!state.enabled) return null;
  const c = state.carrier;
  const statusColor = !c ? "text-text-muted" : c.status === "IN_TRANSIT" ? "text-green-600 dark:text-green-400" : c.loadedCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-text-muted";
  const capacityText = c ? (c.capacity == null ? `${c.loadedCount}` : `${c.loadedCount}/${c.capacity}`) : "";

  return (
    <div className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2" data-testid="carrier-slot">
      <ShoppingCart className="h-4 w-4 shrink-0 text-primary" />
      {!compact && <span className="hidden whitespace-nowrap text-xs font-bold text-text-muted 2xl:inline">{t("carrier.slotLabel", "출력 대차")}</span>}
      {c ? (
        <>
          <span className="font-mono text-sm font-bold text-text">{c.carrierNo}</span>
          <span className={`whitespace-nowrap text-xs font-semibold ${statusColor}`}>
            {c.status === "IN_TRANSIT" ? t("carrier.inTransit", "이동 중") : c.loadedCount > 0 ? t("carrier.loaded", "적재 {{n}}", { n: capacityText }) : t("carrier.empty", "빈 대차")}
          </span>
          <button type="button" data-testid="carrier-slot-slip" onClick={() => setSlipOpen(true)} disabled={c.loadedCount === 0}
            title={t("carrier.slip", "이동전표")} aria-label={t("carrier.slip", "이동전표")}
            className="inline-flex h-7 items-center gap-1 rounded border border-primary px-2 text-xs font-bold text-primary hover:bg-surface disabled:opacity-40">
            <FileOutput className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">{t("carrier.slip", "이동전표")}</span>
          </button>
          <button type="button" data-testid="carrier-slot-clear" onClick={() => void state.clear()} title={t("carrier.clear", "대차 해제")} aria-label={t("carrier.clear", "대차 해제")}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-red-500">
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <div className="w-40">
          <BarcodeScanInput
            value={value}
            onChange={setValue}
            onScan={async (raw) => { const ok = await state.scan(raw); if (ok) setValue(""); }}
            placeholder={t("carrier.scanPlaceholder", "대차 스캔")}
            className="h-8 text-sm"
            disabled={state.loading}
            data-testid="carrier-slot-scan"
            fullWidth
          />
        </div>
      )}
      <CarrierSlipPrintModal isOpen={slipOpen} carrierNo={c?.carrierNo ?? null} onClose={() => { setSlipOpen(false); void state.refresh(); }} />
    </div>
  );
}
