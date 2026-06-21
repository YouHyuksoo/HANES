"use client";

/**
 * @file components/ConLabelDetailPanel.tsx
 * @description 소모품 라벨 발행 - 우측 인스턴스 상세 패널 (미입고 PENDING 목록)
 *
 * 사용법: 부모 컨테이너가 flex row일 때 우측에 붙어서 공간을 차지함
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, MapPin, Box, Activity, Printer, Eye } from "lucide-react";
import { Button, ComCodeBadge } from "@/components/ui";
import { api } from "@/services/api";
import type { LabelableMaster } from "./ConLabelColumns";

export interface InstanceItem {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  status: string;
  location: string | null;
  currentCount: number;
  expectedLife: number | null;
  mountedEquipCode: string | null;
  recvDate: string | null;
  vendorName: string | null;
}

interface Props {
  master: LabelableMaster;
  onClose: () => void;
  onReprint: (instance: InstanceItem) => void;
  onPreview: (instance: InstanceItem) => void;
}

export default function ConLabelDetailPanel({ master, onClose, onReprint, onPreview }: Props) {
  const { t } = useTranslation();
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/consumables/stocks", {
        params: { search: master.consumableCode, limit: "200" },
      });
      const raw = res.data?.data ?? res.data ?? [];
      const items: InstanceItem[] = Array.isArray(raw) ? raw : raw?.data ?? [];
      setInstances(items.filter((i) => i.consumableCode === master.consumableCode && i.status === "PENDING"));
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [master]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  return (
    <div className="w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-text truncate">{master.consumableCode}</h2>
          <p className="text-xs text-text-muted truncate">{master.consumableName}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onClose} className="ml-2 shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 요약 */}
      <div className="px-5 py-3 border-b border-border bg-surface-alt/50 flex items-center gap-4 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="text-text-muted whitespace-nowrap">{t("consumables.comp.currentStock")}:</span>
          <span className="font-semibold">{master.stockQty.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="text-text-muted whitespace-nowrap">{t("consumables.label.pending")}:</span>
          <span className="font-semibold text-amber-500">{master.pendingCount}</span>
        </div>
        {master.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted whitespace-nowrap">{t("consumables.comp.location")}:</span>
            <span className="font-semibold truncate max-w-[100px]">{master.location}</span>
          </div>
        )}
      </div>

      {/* 미입고 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-text-muted">{t("common.loading")}...</div>
        ) : instances.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted">{t("common.noData")}</div>
        ) : (
          <div className="p-3 space-y-2">
            {instances.map((inst) => (
              <div key={inst.conUid} className="rounded-md border border-border bg-surface px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-text truncate">{inst.conUid}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <ComCodeBadge groupCode="CON_STOCK_STATUS" code={inst.status} />
                      <span className="text-[11px] text-text-muted truncate">
                        {inst.location ?? "-"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0 px-2"
                      aria-label={t("consumables.label.previewAria", "{{conUid}} 라벨 미리보기", { conUid: inst.conUid })}
                      onClick={() => onPreview(inst)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      {t("consumables.label.preview", "미리보기")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0 px-2"
                      aria-label={t("consumables.label.reprintAria", "{{conUid}} 라벨 재발행", { conUid: inst.conUid })}
                      onClick={() => onReprint(inst)}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      {t("consumables.label.reprint", "재발행")}
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                  <div className="min-w-0">
                    <span>{t("consumables.stock.shotCount")}: </span>
                    <span className="text-text">
                      {inst.expectedLife
                        ? `${inst.currentCount.toLocaleString()} / ${inst.expectedLife.toLocaleString()}`
                        : inst.currentCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="min-w-0 text-right">
                    <span>{t("consumables.stock.recvDate")}: </span>
                    <span className="text-text">{inst.recvDate ? inst.recvDate.slice(0, 10) : "-"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
