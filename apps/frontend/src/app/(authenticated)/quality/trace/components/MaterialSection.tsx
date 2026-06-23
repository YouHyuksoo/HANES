"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MaterialTrace } from "../types";

export default function MaterialSection({ materials }: { materials: MaterialTrace[] }) {
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
        {t("quality.trace.noMaterials", "투입 자재 없음")}
      </div>
    );

  return (
    <div className="space-y-2">
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
