"use client";
/**
 * @file quality/inspect-measurement-spec/page.tsx
 * @description 품목별 리크/내전압/토크 실측 스펙 마스터
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Gauge } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { createInspectItemSpecGridColumns, type InspectItemSpecRow } from "./inspectItemSpecColumns";
import InspectItemSpecFormPanel, {
  emptyInspectItemSpecForm, validateInspectItemSpecForm, type InspectItemSpecForm,
} from "./InspectItemSpecFormPanel";

const PAGE_SIZE = 100;
const toNum = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export default function InspectMeasurementSpecPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<InspectItemSpecRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<InspectItemSpecRow | null>(null);
  const [form, setForm] = useState<InspectItemSpecForm>(() => emptyInspectItemSpecForm());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText.trim()) params.search = searchText.trim();
      const res = await api.get("/master/inspect-item-specs", { params });
      setRows(res.data?.data ?? []);
      setTotal(Number(res.data?.total ?? res.data?.meta?.total ?? 0));
    } catch {
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, searchText]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const setField = (key: keyof InspectItemSpecForm, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const openCreate = () => { setEditing(null); setForm(emptyInspectItemSpecForm()); setPanelOpen(true); };
  const openEdit = (row: InspectItemSpecRow) => {
    setEditing(row);
    setForm({
      itemCode: row.itemCode, inspectType: row.inspectType, connectorKey: row.connectorKey ?? "*",
      chargeBar: String(row.chargeBar ?? ""), chargeTolBar: "",
      holdSeconds: String(row.holdSeconds ?? ""), minHoldBar: String(row.minHoldBar ?? ""),
      testVoltageKv: String(row.testVoltageKv ?? ""), testSeconds: "",
      maxCurrentMa: String(row.maxCurrentMa ?? ""),
      torqueLsl: String(row.torqueLsl ?? ""), torqueUsl: String(row.torqueUsl ?? ""),
      torqueUnit: "kgf.m", remark: "", useYn: row.useYn,
    });
    setPanelOpen(true);
  };

  const save = async () => {
    if (validateInspectItemSpecForm(form)) return;
    setSaving(true);
    try {
      const body = {
        itemCode: form.itemCode.trim(),
        inspectType: form.inspectType,
        connectorKey: form.connectorKey.trim() || "*",
        chargeBar: toNum(form.chargeBar), chargeTolBar: toNum(form.chargeTolBar),
        holdSeconds: toNum(form.holdSeconds), minHoldBar: toNum(form.minHoldBar),
        testVoltageKv: toNum(form.testVoltageKv), testSeconds: toNum(form.testSeconds),
        maxCurrentMa: toNum(form.maxCurrentMa),
        torqueLsl: toNum(form.torqueLsl), torqueUsl: toNum(form.torqueUsl),
        torqueUnit: form.torqueUnit || null, remark: form.remark || null, useYn: form.useYn,
      };
      if (editing) await api.put(`/master/inspect-item-specs/${editing.specId}`, body);
      else await api.post("/master/inspect-item-specs", body);
      setPanelOpen(false);
      await fetchData();
    } finally { setSaving(false); }
  };

  const columns = createInspectItemSpecGridColumns(t);

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4 min-h-0">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Gauge className="w-7 h-7 text-primary" />
              {t("menu.inspectMeasurementSpec", "검사 실측 스펙")}
            </h1>
            <p className="text-text-muted mt-1">
              {t("master.inspectItemSpec.subtitle", "품목별 리크(Air Leak)·내전압·체결 토크 합격 기준. 통합검사에서 실측값과 대조합니다.")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void fetchData()}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("common.add")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full min-h-0 flex flex-col gap-2 p-3">
            <div className="flex gap-2 flex-shrink-0">
              <div className="w-64">
                <Input value={searchText} onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
                  placeholder={t("common.search")} fullWidth />
              </div>
              <ServerPager page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} />
            </div>
            <div className="flex-1 min-h-0">
              <DataGrid data={rows} columns={columns} isLoading={loading}
                getRowId={(row) => String((row as InspectItemSpecRow).specId)}
                onRowClick={(row) => openEdit(row as InspectItemSpecRow)} />
            </div>
          </CardContent>
        </Card>
      </div>
      {panelOpen && (
        <Card className="w-[380px] min-h-0 flex flex-col flex-shrink-0">
          <InspectItemSpecFormPanel form={form} onChange={setField} onSave={() => void save()}
            onCancel={() => setPanelOpen(false)} saving={saving} isEdit={Boolean(editing)} />
        </Card>
      )}
    </div>
  );
}
