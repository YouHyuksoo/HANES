"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MaterialTrace } from "../types";

export default function MaterialSection({ materials, title }: { materials: MaterialTrace[]; title?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (materials.length === 0)
    return (
      <div className="text-sm text-text-muted py-4">
        {title && <div className="text-sm font-medium text-text mb-2">{title}</div>}
        {t("quality.trace.noMaterials", "투입 자재 없음")}
      </div>
    );

  return (
    <div className="space-y-2">
      {title && <div className="text-sm font-medium text-text mb-1">{title}</div>}
      {materials.map((m) => {
        const id = m.matUid;
        const expanded = open.has(id);
        return (
          <div key={id} className="border border-border rounded-lg">
            <button
              onClick={() => toggle(id)}
              className="w-full flex items-center gap-2 p-3 text-left"
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-mono text-primary">{m.matUid}</span>
              <span className="text-text">{m.itemName || m.itemCode}</span>
              <span className="ml-auto text-sm text-text-muted">
                {m.usedQty.toLocaleString()} {m.unit} · {m.vendorName ?? "-"}
              </span>
            </button>
            {expanded && (
              <>
                <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <NestedRow
                    label={t("quality.trace.po", "발주(PO)")}
                    value={
                      m.po
                        ? `${m.po.poNo} / ${fmtDate(m.po.orderDate)} / ${m.po.partnerName ?? "-"}`
                        : "-"
                    }
                  />
                  <NestedRow
                    label={t("quality.trace.arrival", "입하")}
                    value={
                      m.arrival
                        ? `${m.arrival.arrivalNo} / ${fmtDate(m.arrival.arrivalDate)} / ${m.arrival.qty}`
                        : "-"
                    }
                  />
                  <NestedRow
                    label={t("quality.trace.iqc", "수입검사(IQC)")}
                    value={
                      m.iqc
                        ? `${m.iqc.result} / ${m.iqc.inspectType} / ${m.iqc.inspectorName ?? "-"}`
                        : "-"
                    }
                  />
                  <NestedRow
                    label={t("quality.trace.receiving", "입고")}
                    value={
                      m.receiving
                        ? `${m.receiving.receiveNo} / ${fmtDate(m.receiving.receiveDate)}`
                        : "-"
                    }
                  />
                  <NestedRow
                    label={t("quality.trace.issue", "투입")}
                    value={
                      m.issue
                        ? `${m.issue.orderNo ?? "-"} / ${m.issue.issueQty} / ${fmtDate(m.issue.issueDate)}`
                        : "-"
                    }
                  />
                </div>
                {m.stockHistory && m.stockHistory.length > 0 && (
                  <div className="mt-2 pt-2 mx-4 mb-3 border-t border-border">
                    <div className="text-xs text-text-muted mb-1">{t("quality.trace.stockHistory", "입출고 수불이력")}</div>
                    <div className="space-y-1">
                      {m.stockHistory.map((s, i) => (
                        <div key={`${i}-${s.transNo}`} className="flex items-center gap-3 text-xs">
                          <span className="font-mono text-text-muted shrink-0">{s.transDate.slice(0, 10)}</span>
                          <span className="font-medium text-text shrink-0">{s.transType}</span>
                          <span className="text-text-muted">{s.qty.toLocaleString()}</span>
                          <span className="text-text-muted truncate">{s.fromWarehouse ? (s.fromWarehouseName ?? s.fromWarehouse) : ""}{s.fromWarehouse && s.toWarehouse ? " → " : ""}{s.toWarehouse ? (s.toWarehouseName ?? s.toWarehouse) : ""}</span>
                          {s.refId && <span className="ml-auto font-mono text-text-muted shrink-0">{s.refType ?? ""} {s.refId}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NestedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-text-muted min-w-[96px]">{label}</span>
      <span className="text-text font-mono">{value}</span>
    </div>
  );
}

function fmtDate(s: string | null): string {
  if (!s) return "-";
  return s.length >= 10 ? s.slice(0, 19).replace("T", " ") : s;
}
