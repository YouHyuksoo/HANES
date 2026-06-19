"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import toast from "react-hot-toast";
import { ClipboardList, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { Button, Card, CardContent, ConfirmModal, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface AqlRule {
  lotQtyFrom: number;
  lotQtyTo: number;
  sampleSize: number;
  acceptQty: number;
  rejectQty: number;
  sortOrder?: number | null;
}

interface AqlStandard {
  [key: string]: unknown;
  aqlCode: string;
  aqlName: string;
  inspectionLevel?: string | null;
  aqlValue?: number | null;
  useYn: string;
  remark?: string | null;
  rules?: AqlRule[];
}

const emptyForm: AqlStandard = {
  aqlCode: "",
  aqlName: "",
  inspectionLevel: "II",
  aqlValue: 1,
  useYn: "Y",
  remark: "",
  rules: [
    { lotQtyFrom: 1, lotQtyTo: 50, sampleSize: 5, acceptQty: 0, rejectQty: 1, sortOrder: 1 },
  ],
};

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AqlPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AqlStandard[]>([]);
  const [form, setForm] = useState<AqlStandard>(emptyForm);
  const [selected, setSelected] = useState<AqlStandard | null>(null);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText.trim()) params.search = searchText.trim();
      const res = await api.get("/quality/aql", { params });
      setData(res.data?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadDetail = useCallback(async (row: AqlStandard) => {
    const res = await api.get(`/quality/aql/${encodeURIComponent(row.aqlCode)}`);
    const detail = res.data?.data ?? row;
    setSelected(detail);
    setForm({
      ...detail,
      rules: detail.rules?.length ? detail.rules : [],
    });
  }, []);

  const handleNew = useCallback(() => {
    setSelected(null);
    setForm({ ...emptyForm, rules: [...(emptyForm.rules ?? [])] });
  }, []);

  const setField = useCallback((key: keyof AqlStandard, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setRuleField = useCallback((index: number, key: keyof AqlRule, value: number) => {
    setForm((prev) => ({
      ...prev,
      rules: (prev.rules ?? []).map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [key]: value } : rule,
      ),
    }));
  }, []);

  const addRule = useCallback(() => {
    setForm((prev) => {
      const rules = prev.rules ?? [];
      const lastTo = rules.length ? Math.max(...rules.map((rule) => rule.lotQtyTo)) : 0;
      return {
        ...prev,
        rules: [
          ...rules,
          { lotQtyFrom: lastTo + 1, lotQtyTo: lastTo + 50, sampleSize: 5, acceptQty: 0, rejectQty: 1, sortOrder: rules.length + 1 },
        ],
      };
    });
  }, []);

  const removeRule = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      rules: (prev.rules ?? []).filter((_, ruleIndex) => ruleIndex !== index),
    }));
  }, []);

  const validateForm = useCallback(() => {
    if (!form.aqlCode.trim()) return "AQL 코드를 입력하세요.";
    if (!form.aqlName.trim()) return "AQL 명칭을 입력하세요.";
    const rules = [...(form.rules ?? [])].sort((a, b) => a.lotQtyFrom - b.lotQtyFrom);
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (rule.lotQtyFrom > rule.lotQtyTo) return "LOT 수량 From은 To보다 클 수 없습니다.";
      if (rule.rejectQty <= rule.acceptQty) return "Re 수량은 Ac 수량보다 커야 합니다.";
      const previous = rules[index - 1];
      if (previous && rule.lotQtyFrom <= previous.lotQtyTo) return "LOT 수량 범위가 겹칩니다.";
    }
    return "";
  }, [form]);

  const handleSave = useCallback(async () => {
    const validation = validateForm();
    if (validation) {
      toast.error(validation);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        aqlCode: form.aqlCode.trim().toUpperCase(),
        aqlName: form.aqlName.trim(),
        inspectionLevel: form.inspectionLevel || null,
        aqlValue: form.aqlValue == null ? null : Number(form.aqlValue),
        rules: (form.rules ?? []).map((rule, index) => ({ ...rule, sortOrder: index + 1 })),
      };
      if (selected) {
        await api.put(`/quality/aql/${encodeURIComponent(form.aqlCode)}`, payload);
      } else {
        await api.post("/quality/aql", payload);
      }
      toast.success(selected ? "AQL 기준이 수정되었습니다." : "AQL 기준이 등록되었습니다.");
      await fetchData();
      await loadDetail(payload as AqlStandard);
    } finally {
      setSaving(false);
    }
  }, [fetchData, form, loadDetail, selected, validateForm]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    await api.delete(`/quality/aql/${encodeURIComponent(selected.aqlCode)}`);
    setDeleteOpen(false);
    handleNew();
    await fetchData();
  }, [fetchData, handleNew, selected]);

  const columns = useMemo<ColumnDef<AqlStandard>[]>(() => [
    {
      accessorKey: "aqlCode",
      header: "AQL 코드",
      size: 120,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-primary">{getValue() as string}</span>,
    },
    { accessorKey: "aqlName", header: "AQL 명칭", size: 160 },
    { accessorKey: "inspectionLevel", header: "검사수준", size: 90 },
    { accessorKey: "aqlValue", header: "AQL 값", size: 80, meta: { align: "right" as const } },
    {
      accessorKey: "useYn",
      header: "사용",
      size: 70,
      cell: ({ getValue }) => (
        <span className={getValue() === "Y" ? "text-emerald-600 font-semibold" : "text-text-muted"}>{getValue() as string}</span>
      ),
    },
  ], []);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("quality.aql.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.aql.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={handleNew}>
            <Plus className="w-4 h-4" />{t("common.add")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-5 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              pageSize={50}
              getRowId={(row) => row.aqlCode}
              selectedRowId={selected?.aqlCode}
              onRowClick={loadDetail}
              enableColumnFilter
              enableExport
              exportFileName="AQL 기준관리"
              toolbarLeft={
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="AQL 코드/명칭 검색"
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              }
              sqlQuery={`SELECT AQL_CODE, AQL_NAME, INSPECTION_LEVEL, AQL_VALUE, USE_YN\nFROM AQL_STANDARDS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY AQL_CODE`}
            />
          </CardContent>
        </Card>

        <Card className="col-span-7 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text">{selected ? "AQL 기준 수정" : "AQL 기준 등록"}</h2>
              <div className="flex gap-2">
                {selected && (
                  <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4" />사용중지
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} isLoading={saving}>
                  <Save className="w-4 h-4" />{t("common.save")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Input label="AQL 코드" required value={form.aqlCode}
                disabled={!!selected}
                onChange={(event) => setField("aqlCode", event.target.value)}
                placeholder="AQL-1.0" />
              <Input label="AQL 명칭" required value={form.aqlName}
                onChange={(event) => setField("aqlName", event.target.value)}
                placeholder="일반검사 AQL 1.0" />
              <Input label="검사수준" value={form.inspectionLevel ?? ""}
                onChange={(event) => setField("inspectionLevel", event.target.value)}
                placeholder="II" />
              <Input label="AQL 값" type="number" step="0.001" value={form.aqlValue ?? ""}
                onChange={(event) => setField("aqlValue", toNumber(event.target.value, 0))} />
              <Select label="사용여부" value={form.useYn} onChange={(value) => setField("useYn", value)}
                options={[{ value: "Y", label: "사용" }, { value: "N", label: "미사용" }]} />
              <div className="col-span-3">
                <Input label="비고" value={form.remark ?? ""}
                  onChange={(event) => setField("remark", event.target.value)}
                  fullWidth />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">{t("quality.aql.ruleSection")}</h3>
              <Button variant="secondary" size="sm" onClick={addRule}>
                <Plus className="w-4 h-4" />Rule 추가
              </Button>
            </div>

            <div className="mt-2 rounded border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_44px] bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-text">
                <div className="px-3 py-2">lotQtyFrom</div>
                <div className="px-3 py-2">lotQtyTo</div>
                <div className="px-3 py-2">sampleSize</div>
                <div className="px-3 py-2">acceptQty</div>
                <div className="px-3 py-2">rejectQty</div>
                <div />
              </div>
              {(form.rules ?? []).map((rule, index) => (
                <div key={`${rule.lotQtyFrom}-${index}`} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_44px] border-t border-border bg-surface/60">
                  <div className="p-2"><Input type="number" min={1} value={rule.lotQtyFrom} onChange={(event) => setRuleField(index, "lotQtyFrom", toNumber(event.target.value, 1))} fullWidth /></div>
                  <div className="p-2"><Input type="number" min={1} value={rule.lotQtyTo} onChange={(event) => setRuleField(index, "lotQtyTo", toNumber(event.target.value, 1))} fullWidth /></div>
                  <div className="p-2"><Input type="number" min={0} value={rule.sampleSize} onChange={(event) => setRuleField(index, "sampleSize", toNumber(event.target.value, 0))} fullWidth /></div>
                  <div className="p-2"><Input type="number" min={0} value={rule.acceptQty} onChange={(event) => setRuleField(index, "acceptQty", toNumber(event.target.value, 0))} fullWidth /></div>
                  <div className="p-2"><Input type="number" min={0} value={rule.rejectQty} onChange={(event) => setRuleField(index, "rejectQty", toNumber(event.target.value, 0))} fullWidth /></div>
                  <div className="p-2 flex items-center justify-center">
                    <button className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" onClick={() => removeRule(index)} title="삭제">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(form.rules ?? []).length === 0 && (
                <div className="p-6 text-sm text-text-muted text-center">LOT 수량별 rule을 추가하세요.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="AQL 기준 사용중지"
        message={`${selected?.aqlCode ?? ""} 기준을 사용중지하시겠습니까?`}
      />
    </div>
  );
}
