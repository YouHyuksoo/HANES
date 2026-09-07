"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { XCircle } from "lucide-react";
import { Select } from "@/components/ui";

/** 담긴 시리얼 표시만 담당한다. 열 변경으로 실제 박스 구성은 바뀌지 않는다. */
export default function PackedSerialList({ serials, onRemove }: {
  serials: string[];
  onRemove: (serial: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [columns, setColumns] = useState("1");
  const language = i18n.language.split("-")[0];
  const label = ({ ko: "표시 열 수", en: "Columns", zh: "显示列数", vi: "Số cột" } as Record<string, string>)[language] ?? "Columns";
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Select label={label} value={columns} onChange={setColumns}
          options={[1, 2, 3, 4, 5].map((count) => ({ value: String(count), label: String(count) }))} />
      </div>
      <div className="max-h-72 overflow-auto border border-border rounded-lg p-2">
        {serials.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">{t("shipping.pack.noSerials")}</p>
        ) : (
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(140px, 1fr))` }}>
            {serials.map((serial, index) => (
              <div key={serial} className="flex items-center justify-between gap-1 py-1 px-2 hover:bg-background rounded">
                <span className="text-xs font-mono break-all">{index + 1}. {serial}</span>
                <button type="button" className="shrink-0" title={t("shipping.pack.removeSerial")}
                  aria-label={`${t("shipping.pack.removeSerial")} ${serial}`} onClick={() => onRemove(serial)}>
                  <XCircle className="w-4 h-4 text-text-muted hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
