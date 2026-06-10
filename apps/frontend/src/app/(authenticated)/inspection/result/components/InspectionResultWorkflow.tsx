"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScanLine, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import api from "@/services/api";
import type { JobOrderRow } from "../types";
import InspectPanel from "./InspectPanel";

interface Props {
  titleKey: string;
  descriptionKey: string;
  searchPlaceholderKey: string;
  selectOrderKey: string;
  inspectType: "CONTINUITY" | "TERMINAL";
}

export default function InspectionResultWorkflow({
  titleKey,
  descriptionKey,
  searchPlaceholderKey,
  selectOrderKey,
  inspectType,
}: Props) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<JobOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<JobOrderRow | null>(null);
  const [searchText, setSearchText] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
            {t(titleKey)}
          </h1>
          <p className="text-text-muted mt-1">{t(descriptionKey)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchOrders}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        <Card className="col-span-4 overflow-hidden flex flex-col" padding="none">
          <CardContent className="flex flex-col h-full p-3 gap-2">
            <Input
              placeholder={t(searchPlaceholderKey)}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
            <div className="flex-1 overflow-auto">
              {filtered.length === 0 && !loading && (
                <p className="text-sm text-text-muted text-center mt-8">
                  {t("common.noData")}
                </p>
              )}
              {filtered.map((o) => (
                <button
                  key={o.orderNo}
                  onClick={() => setSelected(o)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors text-sm
                    ${selected?.orderNo === o.orderNo
                      ? "bg-primary/10 dark:bg-primary/20 border border-primary/30"
                      : "hover:bg-gray-100 dark:hover:bg-slate-700 border border-transparent"
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-semibold text-text">{o.orderNo}</span>
                    <ComCodeBadge groupCode="JOB_STATUS" code={o.status} />
                  </div>
                  <p className="text-text-muted truncate mt-0.5">{o.itemName ?? o.itemCode}</p>
                  <div className="flex gap-3 mt-1 text-xs text-text-muted">
                    <span>{t("inspection.result.planQty")}: {o.planQty}</span>
                    <span className="text-green-600 dark:text-green-400">{t("inspection.result.pass")}: {o.goodQty}</span>
                    <span className="text-red-600 dark:text-red-400">{t("inspection.result.fail")}: {o.defectQty}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="col-span-8 overflow-hidden flex flex-col">
          {selected ? (
            <InspectPanel key={`${inspectType}-${selected.orderNo}`} order={selected} inspectType={inspectType} />
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <CardContent>
                <div className="text-center text-text-muted">
                  <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t(selectOrderKey)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
