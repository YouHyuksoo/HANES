"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Factory } from "lucide-react";

export interface JobOrderHudPayload {
  orderNo: string;
  itemCode?: string;
  itemName?: string;
  processCode?: string;
}

const JOB_ORDER_HUD_EVENT = "hanes:job-order-selected";

export function showJobOrderHud(payload: JobOrderHudPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<JobOrderHudPayload>(JOB_ORDER_HUD_EVENT, { detail: payload }));
}

export default function JobOrderHud() {
  const { t } = useTranslation();
  const [payload, setPayload] = useState<JobOrderHudPayload | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleSelected = (event: Event) => {
      const next = (event as CustomEvent<JobOrderHudPayload>).detail;
      if (!next?.orderNo) return;
      setPayload(next);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPayload(null), 2200);
    };
    window.addEventListener(JOB_ORDER_HUD_EVENT, handleSelected);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(JOB_ORDER_HUD_EVENT, handleSelected);
    };
  }, []);

  if (!payload) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center px-4" aria-live="polite">
      <div className="animate-in fade-in zoom-in-95 duration-200 w-[min(720px,calc(100vw-2rem))] rounded-2xl border border-primary/60 bg-surface/75 px-12 py-8 text-center shadow-[0_0_45px_rgba(34,197,94,0.28)] backdrop-blur-md">
        <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-primary">
          <ClipboardCheck className="h-5 w-5" />
          {t("production.jobOrderHud.selected", "작업지시 선택 완료")}
        </div>
        <div className="font-mono text-3xl font-bold tracking-wide text-text">{payload.orderNo}</div>
        <div className="mt-3 flex items-center justify-center gap-2 text-base text-text-muted">
          <span>{payload.itemName || payload.itemCode || t("common.item", "품목")}</span>
          {payload.processCode && (
            <>
              <span className="text-text-muted/60">·</span>
              <span className="inline-flex items-center gap-1"><Factory className="h-3.5 w-3.5" />{payload.processCode}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
