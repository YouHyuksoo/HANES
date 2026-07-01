"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { SemiProductTrace } from "../types";
import MaterialSection from "./MaterialSection";

const SG_STATUS_CLS: Record<string, string> = {
  IN_STOCK:  "text-blue-600 border-blue-400",
  MOUNTED:   "text-amber-600 border-amber-400",
  CONSUMED:  "text-text-muted border-border",
  DEFECT:    "text-red-600 border-red-400",
};

function SgStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = SG_STATUS_CLS[status] ?? "text-text-muted border-border";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>{t(`comCode.SG_LABEL_STATUS.${status}`, status)}</span>;
}

export default function SemiProductSection({ semiProducts }: { semiProducts: SemiProductTrace[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (semiProducts.length === 0)
    return (
      <div className="text-sm text-text-muted py-4">
        {t("quality.trace.noSemiProducts", "투입 반제품 없음")}
      </div>
    );

  return (
    <div className="space-y-2">
      {semiProducts.map((sp) => {
        const expanded = open.has(sp.sgBarcode);
        return (
          <div key={sp.sgBarcode} className="border border-border rounded-lg">
            <button
              onClick={() => toggle(sp.sgBarcode)}
              className="w-full flex items-center gap-2 p-3 text-left"
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-mono text-primary">{sp.sgBarcode}</span>
              <span className="text-text">{sp.itemName || sp.itemCode}</span>
              <span className="ml-auto flex items-center gap-2 text-sm text-text-muted shrink-0">
                {sp.consumedQty.toLocaleString()}
                {sp.warehouseCode && <span className="font-mono text-xs">{sp.warehouseCode}</span>}
                <SgStatusBadge status={sp.status} />
              </span>
            </button>
            {expanded && (
              <div className="px-4 pb-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-text mb-2">
                    {t("quality.trace.processTimeline", "공정 생산이력")}
                  </div>
                  <ul className="text-sm space-y-1">
                    {sp.processHistory.map((s, i) => (
                      <li key={`${i}-${s.timestamp}-${s.process}`} className="flex gap-2 text-text-muted">
                        <span className="font-mono">
                          {s.timestamp.slice(0, 19).replace("T", " ")}
                        </span>
                        <span className="text-text">{s.processName}</span>
                        <span>
                          {s.equipmentName} / {s.operator}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium text-text mb-2">
                    {t("quality.trace.semiMaterials", "반제품 투입 자재")}
                  </div>
                  <MaterialSection materials={sp.materials} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
