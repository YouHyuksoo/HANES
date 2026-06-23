"use client";
import { useTranslation } from "react-i18next";
import type { EquipConsumable } from "../types";

export default function EquipConsumableSection({ consumables }: { consumables: EquipConsumable[] }) {
  const { t } = useTranslation();

  if (consumables.length === 0) {
    return (
      <div className="text-sm text-text-muted py-1.5">
        {t("quality.trace.noEquipConsumables", "설비 장착 소모품 없음")}
      </div>
    );
  }

  function actionLabel(action: string): { label: string; cls: string } {
    if (action === "MOUNT") return { label: t("quality.trace.actionMount", "장착"), cls: "text-green-600 border-green-600" };
    if (action === "UNMOUNT") return { label: t("quality.trace.actionUnmount", "탈거"), cls: "text-orange-600 border-orange-600" };
    return { label: action, cls: "text-blue-600 border-blue-600" };
  }

  return (
    <ul className="divide-y divide-border">
      {consumables.map((c, i) => {
        const { label, cls } = actionLabel(c.action);
        return (
          <li key={`${i}-${c.consumableCode}-${c.mountAt}`} className="flex items-center gap-3 text-sm py-1.5">
            <span className="font-mono text-xs text-text-muted shrink-0">
              {(c.mountAt ?? "").slice(0, 16).replace("T", " ")}
            </span>
            <span className="font-medium text-text">{c.consumableName}</span>
            <span className="text-xs text-text-muted truncate">
              {c.consumableCode} / {c.equipCode}
            </span>
            <span className="text-xs text-text-muted">{c.workerId ?? "-"}</span>
            <span className="ml-auto shrink-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>
                {label}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
