"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ScanLine, RefreshCw, Search, Cpu, Maximize2, Minimize2,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import api from "@/services/api";
import type { IntegratedJobOrderRow } from "../types";
import IntegratedInspectPanel from "./IntegratedInspectPanel";

interface TesterEquip {
  equipCode: string;
  equipName: string;
}

function normalizeTesters(payload: unknown): TesterEquip[] {
  const arr = Array.isArray(payload) ? payload : [];
  return arr.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const rec = item as Record<string, unknown>;
    if (typeof rec.equipCode !== "string") return [];
    const equipName =
      typeof rec.equipName === "string" && rec.equipName.trim() ? rec.equipName : rec.equipCode;
    return [{ equipCode: rec.equipCode, equipName }];
  });
}

interface Props {
  title: string;
  description: string;
  searchPlaceholder: string;
}

export default function IntegratedInspectWorkflow({
  title, description, searchPlaceholder,
}: Props) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<IntegratedJobOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<IntegratedJobOrderRow | null>(null);
  const [searchText, setSearchText] = useState("");
  const [testers, setTesters] = useState<TesterEquip[]>([]);
  const [selectedEquipCode, setSelectedEquipCode] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const equipStorageKey = "hanes:inspection:equip:INTEGRATED";

  const handleSelectEquip = useCallback((code: string) => {
    setSelectedEquipCode(code);
    try {
      if (code) localStorage.setItem(equipStorageKey, code);
      else localStorage.removeItem(equipStorageKey);
    } catch {}
  }, [equipStorageKey]);

  useEffect(() => {
    let saved = "";
    try { saved = localStorage.getItem(equipStorageKey) ?? ""; } catch { saved = ""; }
    if (saved) setSelectedEquipCode(saved);

    api
      .get("/equipment/equips/type/TESTER")
      .then((res) => {
        const list = normalizeTesters(res.data?.data ?? []);
        setTesters(list);
        if (saved && !list.some((e) => e.equipCode === saved)) {
          setSelectedEquipCode("");
          try { localStorage.removeItem(equipStorageKey); } catch {}
        }
      })
      .catch(() => setTesters([]));
  }, [equipStorageKey]);

  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchText]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/continuity-inspect/job-orders");
      setOrders(res.data?.data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return orders;
    const q = debouncedSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        (o.itemName ?? "").toLowerCase().includes(q) ||
        o.itemCode.toLowerCase().includes(q),
    );
  }, [orders, debouncedSearch]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ScanLine className="w-7 h-7 text-primary" />
            {title}
          </h1>
          <p className="text-text-muted mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-primary shrink-0" />
            <Select
              value={selectedEquipCode}
              onChange={handleSelectEquip}
              placeholder={t("inspection.result.selectEquip")}
              options={testers.map((e) => ({ value: e.equipCode, label: `${e.equipName} (${e.equipCode})` }))}
              className="min-w-[200px]"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchOrders}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            aria-label={isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="col-span-4 flex flex-col gap-4 min-h-0 overflow-hidden">
          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col" padding="none">
            <CardContent className="flex flex-col h-full p-3 gap-2">
              <Input
                placeholder={searchPlaceholder}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
              <div className="flex-1 overflow-auto min-h-0">
                {filtered.length === 0 && !loading && (
                  <p className="text-sm text-text-muted text-center mt-8">
                    {t("common.noData")}
                  </p>
                )}
                {filtered.map((o) => (
                  <button
                    key={o.orderNo}
                    onClick={() => setSelected(o)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg mb-1 transition-colors text-sm
                      ${selected?.orderNo === o.orderNo
                        ? "bg-primary/10 dark:bg-primary/20 border border-primary/30"
                        : "hover:bg-gray-100 dark:hover:bg-slate-700 border border-transparent"
                      }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono font-semibold text-text truncate">{o.orderNo}</span>
                      <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={o.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-text-muted truncate text-xs min-w-0">{o.itemName ?? o.itemCode}</span>
                      <span className="flex items-center gap-1 text-xs shrink-0 tabular-nums">
                        <span className="text-text-muted">{o.planQty}</span>
                        <span className="text-text-muted/40">/</span>
                        <span className="text-green-600 dark:text-green-400">{o.goodQty}</span>
                        <span className="text-text-muted/40">/</span>
                        <span className="text-red-600 dark:text-red-400">{o.defectQty}</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-8 overflow-hidden flex flex-col">
          {selected ? (
            <IntegratedInspectPanel
              key={`integrated-${selected.orderNo}`}
              order={selected}
              equipCode={selectedEquipCode || undefined}
            />
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <CardContent>
                <div className="text-center text-text-muted">
                  <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t("inspection.integrated.selectOrder", "통합검사할 작업지시를 선택하세요")}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
