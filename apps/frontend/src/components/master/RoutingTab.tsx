"use client";

/**
 * @file components/master/RoutingTab.tsx
 * @description 라우팅관리 탭 - 품목별 공정순서(ProcessMap) CRUD + API 연동
 *
 * 초보자 가이드:
 * 1. 품목별 공정순서를 DataGrid로 표시 (API 연동)
 * 2. 품목 필터로 특정 품목의 라우팅만 조회
 * 3. 공정 상세정보: 전선길이, 탈피값, 압착높이/폭, 융착조건 입력
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface Routing {
  id: string;
  itemCode: string;
  itemName: string;
  seq: number;
  processCode: string;
  processName: string;
  processType: string;
  equipType?: string;
  stdTime?: number;
  setupTime?: number;
  wireLength?: number;
  stripLength?: number;
  crimpHeight?: number;
  crimpWidth?: number;
  weldCondition?: string;
  processParams?: string;
  useYn: string;
}

interface PartOption {
  value: string;
  label: string;
}

const EMPTY_FORM = {
  itemCode: "", seq: 1, processCode: "", processName: "", processType: "",
  equipType: "", stdTime: "", setupTime: "", wireLength: "", stripLength: "",
  crimpHeight: "", crimpWidth: "", weldCondition: "", processParams: "", useYn: "Y",
};

export default function RoutingTab() {
  const { t } = useTranslation();
  const processTypeOptions = useComCodeOptions("PROCESS_TYPE");

  const [data, setData] = useState<Routing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [partOptions, setPartOptions] = useState<PartOption[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Routing | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchParts = useCallback(async () => {
    try {
      const res = await api.get("/master/parts", { params: { limit: 5000 } });
      const parts = res.data?.data ?? [];
      setPartOptions(parts.map((p: { id: string; itemCode: string; itemName: string }) => ({
        value: p.id,
        label: `${p.itemCode} ${p.itemName}`,
      })));
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (partFilter) params.itemCode = partFilter;
      if (searchText) params.search = searchText;
      const res = await api.get("/master/routings", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [partFilter, searchText]);

  useEffect(() => { fetchParts(); }, [fetchParts]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const partFilterOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    ...partOptions,
  ], [t, partOptions]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM, itemCode: partFilter || "" });
    setIsModalOpen(true);
  }, [partFilter]);

  const openEdit = useCallback((item: Routing) => {
    setEditingItem(item);
    setForm({
      itemCode: item.itemCode, seq: item.seq,
      processCode: item.processCode, processName: item.processName,
      processType: item.processType || "", equipType: item.equipType || "",
      stdTime: item.stdTime?.toString() || "", setupTime: item.setupTime?.toString() || "",
      wireLength: item.wireLength?.toString() || "", stripLength: item.stripLength?.toString() || "",
      crimpHeight: item.crimpHeight?.toString() || "", crimpWidth: item.crimpWidth?.toString() || "",
      weldCondition: item.weldCondition || "", processParams: item.processParams || "",
      useYn: item.useYn,
    });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.processCode || !form.processName) return;
    setSaving(true);
    try {
      const payload = {
        itemCode: form.itemCode,
        seq: Number(form.seq),
        processCode: form.processCode,
        processName: form.processName,
        processType: form.processType || undefined,
        equipType: form.equipType || undefined,
        stdTime: form.stdTime ? Number(form.stdTime) : undefined,
        setupTime: form.setupTime ? Number(form.setupTime) : undefined,
        wireLength: form.wireLength ? Number(form.wireLength) : undefined,
        stripLength: form.stripLength ? Number(form.stripLength) : undefined,
        crimpHeight: form.crimpHeight ? Number(form.crimpHeight) : undefined,
        crimpWidth: form.crimpWidth ? Number(form.crimpWidth) : undefined,
        weldCondition: form.weldCondition || undefined,
        processParams: form.processParams || undefined,
        useYn: form.useYn,
      };
      if (editingItem) {
        await api.put(`/master/routings/${editingItem.id}`, payload);
      } else {
        await api.post("/master/routings", payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, editingItem, fetchData]);

  const handleDelete = useCallback(async (item: Routing) => {
    try {
      await api.delete(`/master/routings/${item.id}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [fetchData]);

  const columns = useMemo<ColumnDef<Routing>[]>(() => [
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "itemName", header: t("common.partName"), size: 120,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "seq", header: t("master.routing.seq"), size: 60, meta: { filterType: "number" as const } },
    { accessorKey: "processCode", header: t("master.routing.processCode"), size: 100 },
    { accessorKey: "processName", header: t("master.routing.processName"), size: 120 },
    { accessorKey: "processType", header: t("common.type"), size: 80,
      meta: { filterType: "multi" as const, filterOptions: processTypeOptions },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />,
    },
    { accessorKey: "equipType", header: t("master.routing.equipType"), size: 80 },
    { accessorKey: "stdTime", header: t("master.routing.stdTime"), size: 75,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : "-",
    },
    { accessorKey: "wireLength", header: t("master.routing.wireLength"), size: 85,
      cell: ({ getValue }) => getValue() != null ? `${getValue()}mm` : "-",
    },
    { accessorKey: "stripLength", header: t("master.routing.stripLength"), size: 85,
      cell: ({ getValue }) => getValue() != null ? `${getValue()}mm` : "-",
    },
    { accessorKey: "crimpHeight", header: t("master.routing.crimpHeight"), size: 85,
      cell: ({ getValue }) => getValue() != null ? `${getValue()}mm` : "-",
    },
    { accessorKey: "crimpWidth", header: t("master.routing.crimpWidth"), size: 85,
      cell: ({ getValue }) => getValue() != null ? `${getValue()}mm` : "-",
    },
    { accessorKey: "useYn", header: t("master.routing.use"), size: 50,
      meta: { filterType: "multi" as const, filterOptions: [{ value: "Y", label: "Y" }, { value: "N", label: "N" }] },
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
    { id: "actions", header: t("common.actions"), size: 80,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => handleDelete(row.original)} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t, processTypeOptions, openEdit, handleDelete]);

  const setField = (key: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <Card>
        <CardContent>
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName="라우팅"
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.routing.searchPlaceholder")}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-64 flex-shrink-0">
                  <Select options={partFilterOptions}
                    value={partFilter} onChange={setPartFilter} fullWidth />
                </div>
                <Button variant="secondary" onClick={fetchData}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" />{t("master.routing.addRouting")}
                </Button>
              </div>
            } />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingItem ? t("master.routing.editRouting") : t("master.routing.addRouting")} size="xl">
        <div className="grid grid-cols-3 gap-4">
          {/* 기본 정보 */}
          <div className="col-span-2">
            <Select label={t("master.routing.partSelect")} options={partOptions}
              value={form.itemCode} onChange={(v) => setField("itemCode", v)}
              disabled={!!editingItem} fullWidth />
          </div>
          <Input label={t("master.routing.seq")} type="number" placeholder="1"
            value={form.seq.toString()} onChange={(e) => setField("seq", e.target.value)} fullWidth />
          <Input label={t("master.routing.processCode")} placeholder="CUT-01"
            value={form.processCode} onChange={(e) => setField("processCode", e.target.value)} fullWidth />
          <Input label={t("master.routing.processName")} placeholder={t("master.routing.processName")}
            value={form.processName} onChange={(e) => setField("processName", e.target.value)} fullWidth />
          <Select label={t("master.routing.processType")} options={processTypeOptions}
            value={form.processType} onChange={(v) => setField("processType", v)} fullWidth />
          <Input label={t("master.routing.equipType")} placeholder={t("master.routing.equipTypePlaceholder")}
            value={form.equipType} onChange={(e) => setField("equipType", e.target.value)} fullWidth />
          <Input label={t("master.routing.stdTimeSec")} type="number" placeholder="5.5"
            value={form.stdTime} onChange={(e) => setField("stdTime", e.target.value)} fullWidth />
          <Input label={t("master.routing.setupTimeSec")} type="number" placeholder="10"
            value={form.setupTime} onChange={(e) => setField("setupTime", e.target.value)} fullWidth />

          {/* 공정 상세 파라미터 */}
          <div className="col-span-3 border-t border-border pt-4 mt-2">
            <h3 className="text-sm font-semibold text-text mb-3">{t("master.routing.processDetailTitle")}</h3>
          </div>
          <Input label={t("master.routing.wireLength")} type="number" placeholder="150.5"
            value={form.wireLength} onChange={(e) => setField("wireLength", e.target.value)} fullWidth />
          <Input label={t("master.routing.stripLength")} type="number" placeholder="5.0"
            value={form.stripLength} onChange={(e) => setField("stripLength", e.target.value)} fullWidth />
          <div />
          <Input label={t("master.routing.crimpHeight")} type="number" placeholder="2.35"
            value={form.crimpHeight} onChange={(e) => setField("crimpHeight", e.target.value)} fullWidth />
          <Input label={t("master.routing.crimpWidth")} type="number" placeholder="3.10"
            value={form.crimpWidth} onChange={(e) => setField("crimpWidth", e.target.value)} fullWidth />
          <div />
          <div className="col-span-3">
            <Input label={t("master.routing.weldCondition")} placeholder={t("master.routing.weldConditionPlaceholder")}
              value={form.weldCondition} onChange={(e) => setField("weldCondition", e.target.value)} fullWidth />
          </div>

          {/* 사용여부 */}
          <Select label={t("common.useYn")} options={[{ value: "Y", label: "Y" }, { value: "N", label: "N" }]}
            value={form.useYn} onChange={(v) => setField("useYn", v)} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.add")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
