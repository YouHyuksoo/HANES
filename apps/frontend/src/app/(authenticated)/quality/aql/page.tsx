"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import toast from "react-hot-toast";
import { ClipboardList, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { Button, Card, CardContent, ConfirmModal, Input } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import { QtyInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { HelpField, HelpHeader } from "./components/AqlFieldHelp";

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

interface IqcAqlPolicy {
  [key: string]: unknown;
  policyCode: string;
  policyName: string;
  inspectionLevel?: string | null;
  majorAqlCode?: string | null;
  minorAqlCode?: string | null;
  criticalMode?: string | null;
  useYn: string;
  remark?: string | null;
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

const emptyPolicyForm: IqcAqlPolicy = {
  policyCode: "",
  policyName: "",
  inspectionLevel: "II",
  majorAqlCode: "",
  minorAqlCode: "",
  criticalMode: "IMMEDIATE_FAIL",
  useYn: "Y",
  remark: "",
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
  const [policies, setPolicies] = useState<IqcAqlPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<IqcAqlPolicy | null>(null);
  const [policyForm, setPolicyForm] = useState<IqcAqlPolicy>(emptyPolicyForm);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyDeleteOpen, setPolicyDeleteOpen] = useState(false);

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

  const fetchPolicies = useCallback(async () => {
    const res = await api.get("/quality/aql/policies");
    setPolicies(res.data?.data ?? []);
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

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
    if (!form.aqlCode.trim()) return t("quality.aql.validateAqlCode", "AQL 코드를 입력하세요.");
    if (!form.aqlName.trim()) return t("quality.aql.validateAqlName", "AQL 명칭을 입력하세요.");
    const rules = [...(form.rules ?? [])].sort((a, b) => a.lotQtyFrom - b.lotQtyFrom);
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (rule.lotQtyFrom > rule.lotQtyTo) return t("quality.aql.validateLotRange", "LOT 수량 From은 To보다 클 수 없습니다.");
      if (rule.rejectQty <= rule.acceptQty) return t("quality.aql.validateReAc", "Re 수량은 Ac 수량보다 커야 합니다.");
      const previous = rules[index - 1];
      if (previous && rule.lotQtyFrom <= previous.lotQtyTo) return t("quality.aql.validateLotOverlap", "LOT 수량 범위가 겹칩니다.");
    }
    return "";
  }, [form, t]);

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
      toast.success(selected ? t("quality.aql.toastUpdated", "AQL 기준이 수정되었습니다.") : t("quality.aql.toastCreated", "AQL 기준이 등록되었습니다."));
      await fetchData();
      await loadDetail(payload as AqlStandard);
    } finally {
      setSaving(false);
    }
  }, [fetchData, form, loadDetail, selected, validateForm, t]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    await api.delete(`/quality/aql/${encodeURIComponent(selected.aqlCode)}`);
    setDeleteOpen(false);
    handleNew();
    await fetchData();
  }, [fetchData, handleNew, selected]);

  const activeAqlOptions = useMemo(
    () => data
      .filter((aql) => aql.useYn === "Y")
      .map((aql) => ({ value: aql.aqlCode, label: `${aql.aqlCode} - ${aql.aqlName}` })),
    [data],
  );

  const handlePolicyNew = useCallback(() => {
    setSelectedPolicy(null);
    setPolicyForm({ ...emptyPolicyForm });
  }, []);

  const loadPolicy = useCallback((row: IqcAqlPolicy) => {
    setSelectedPolicy(row);
    setPolicyForm({ ...row });
  }, []);

  const setPolicyField = useCallback((key: keyof IqcAqlPolicy, value: string) => {
    setPolicyForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validatePolicyForm = useCallback(() => {
    if (!policyForm.policyCode.trim()) return t("quality.aql.validatePolicyCode", "정책 코드를 입력하세요.");
    if (!policyForm.policyName.trim()) return t("quality.aql.validatePolicyName", "정책명을 입력하세요.");
    if (!policyForm.majorAqlCode) return t("quality.aql.validateMajorAql", "Major AQL 기준을 선택하세요.");
    if (!policyForm.minorAqlCode) return t("quality.aql.validateMinorAql", "Minor AQL 기준을 선택하세요.");
    return "";
  }, [policyForm, t]);

  const handlePolicySave = useCallback(async () => {
    const validation = validatePolicyForm();
    if (validation) {
      toast.error(validation);
      return;
    }

    setPolicySaving(true);
    try {
      const payload = {
        policyCode: policyForm.policyCode.trim().toUpperCase(),
        policyName: policyForm.policyName.trim(),
        inspectionLevel: policyForm.inspectionLevel || null,
        majorAqlCode: policyForm.majorAqlCode || null,
        minorAqlCode: policyForm.minorAqlCode || null,
        useYn: policyForm.useYn,
        remark: policyForm.remark || null,
      };
      if (selectedPolicy) {
        await api.put(`/quality/aql/policies/${encodeURIComponent(policyForm.policyCode)}`, payload);
      } else {
        await api.post("/quality/aql/policies", payload);
      }
      toast.success(selectedPolicy ? t("quality.aql.toastPolicyUpdated", "AQL 정책이 수정되었습니다.") : t("quality.aql.toastPolicyCreated", "AQL 정책이 등록되었습니다."));
      await fetchPolicies();
      setSelectedPolicy(payload as IqcAqlPolicy);
      setPolicyForm(payload as IqcAqlPolicy);
    } finally {
      setPolicySaving(false);
    }
  }, [fetchPolicies, policyForm, selectedPolicy, validatePolicyForm, t]);

  const handlePolicyDelete = useCallback(async () => {
    if (!selectedPolicy) return;
    await api.delete(`/quality/aql/policies/${encodeURIComponent(selectedPolicy.policyCode)}`);
    setPolicyDeleteOpen(false);
    handlePolicyNew();
    await fetchPolicies();
  }, [fetchPolicies, handlePolicyNew, selectedPolicy]);

  const columns = useMemo<ColumnDef<AqlStandard>[]>(() => [
    {
      accessorKey: "aqlCode",
      header: () => <HelpHeader field="aqlCode" label={t("quality.aql.aqlCode", "AQL 코드")} />,
      size: 120,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-primary">{getValue() as string}</span>,
    },
    { accessorKey: "aqlName", header: () => <HelpHeader field="aqlName" label={t("quality.aql.aqlName", "AQL 명칭")} />, size: 160 },
    { accessorKey: "inspectionLevel", header: () => <HelpHeader field="inspectionLevel" label={t("quality.aql.inspectionLevel", "검사수준")} />, size: 90 },
    { accessorKey: "aqlValue", header: () => <HelpHeader field="aqlValue" label={t("quality.aql.aqlValue", "AQL 값")} />, size: 80, meta: { align: "right" as const } },
    {
      accessorKey: "useYn",
      header: () => <HelpHeader field="useYn" label={t("quality.aql.use", "사용")} />,
      size: 70,
      cell: ({ getValue }) => (
        <span className={getValue() === "Y" ? "text-emerald-600 font-semibold" : "text-text-muted"}>{getValue() as string}</span>
      ),
    },
  ], [t]);

  const policyColumns = useMemo<ColumnDef<IqcAqlPolicy>[]>(() => [
    {
      accessorKey: "policyCode",
      header: () => <HelpHeader field="policyCode" label={t("quality.aql.policyCode", "정책 코드")} />,
      size: 130,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-primary">{getValue() as string}</span>,
    },
    { accessorKey: "policyName", header: () => <HelpHeader field="policyName" label={t("quality.aql.policyName", "정책명")} />, size: 180 },
    { accessorKey: "inspectionLevel", header: () => <HelpHeader field="policyInspectionLevel" label={t("quality.aql.inspectionLevel", "검사수준")} />, size: 70 },
    { accessorKey: "majorAqlCode", header: () => <HelpHeader field="policyMajorAqlCode" label={t("quality.aql.major", "Major")} />, size: 110 },
    { accessorKey: "minorAqlCode", header: () => <HelpHeader field="policyMinorAqlCode" label={t("quality.aql.minor", "Minor")} />, size: 110 },
    { accessorKey: "useYn", header: () => <HelpHeader field="policyUseYn" label={t("quality.aql.use", "사용")} />, size: 60 },
  ], [t]);

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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={handleNew}>
            <Plus className="w-4 h-4" />{t("quality.aql.addStandard", "AQL 기준 추가")}
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button variant="secondary" size="sm" onClick={addRule}>
            <Plus className="w-4 h-4" />{t("quality.aql.addRule", "판정기준 추가")}
          </Button>
          {selected && (
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-4 h-4" />{t("quality.aql.disable", "사용중지")}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} isLoading={saving}>
            <Save className="w-4 h-4" />{t("common.save")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-5 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-3 overflow-hidden flex flex-col">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-text">{t("quality.aql.policySection", "AQL 정책관리")}</h2>
                <p className="mt-0.5 text-xs text-text-muted">{t("quality.aql.policySectionDesc", "IQC_AQL_POLICIES 기준으로 품목에 적용할 Major/Minor AQL 조합을 관리합니다.")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={handlePolicyNew}>
                  <Plus className="w-4 h-4" />{t("quality.aql.addPolicy", "정책 추가")}
                </Button>
                {selectedPolicy && (
                  <Button variant="danger" size="sm" onClick={() => setPolicyDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4" />{t("quality.aql.disable", "사용중지")}
                  </Button>
                )}
                <Button size="sm" onClick={handlePolicySave} isLoading={policySaving}>
                  <Save className="w-4 h-4" />{t("quality.aql.savePolicy", "정책 저장")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 flex-shrink-0">
              <HelpField field="policyCode" label={t("quality.aql.policyCode", "정책 코드")} required>
                <Input value={policyForm.policyCode}
                  disabled={!!selectedPolicy}
                  onChange={(event) => setPolicyField("policyCode", event.target.value)}
                  placeholder="AQLP-II-1.0-2.5" className="!h-9" fullWidth />
              </HelpField>
              <HelpField field="policyName" label={t("quality.aql.policyName", "정책명")} required>
                <Input value={policyForm.policyName}
                  onChange={(event) => setPolicyField("policyName", event.target.value)}
                  placeholder="II Major 1.0 Minor 2.5" className="!h-9" fullWidth />
              </HelpField>
              <HelpField field="policyInspectionLevel" label={t("quality.aql.inspectionLevel", "검사수준")}>
                <ComCodeSelect groupCode="AQL_INSP_LEVEL" includeAll={false}
                  value={policyForm.inspectionLevel ?? ""}
                  onChange={(value) => setPolicyField("inspectionLevel", value)} fullWidth />
              </HelpField>
              <HelpField field="policyMajorAqlCode" label={t("quality.aql.majorAql", "Major AQL")}>
                <select
                  className="h-9 w-full rounded border border-border bg-surface px-3 text-sm text-text"
                  value={policyForm.majorAqlCode ?? ""}
                  onChange={(event) => setPolicyField("majorAqlCode", event.target.value)}
                >
                  <option value="">{t("quality.aql.selectOption", "선택")}</option>
                  {activeAqlOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </HelpField>
              <HelpField field="policyMinorAqlCode" label={t("quality.aql.minorAql", "Minor AQL")}>
                <select
                  className="h-9 w-full rounded border border-border bg-surface px-3 text-sm text-text"
                  value={policyForm.minorAqlCode ?? ""}
                  onChange={(event) => setPolicyField("minorAqlCode", event.target.value)}
                >
                  <option value="">{t("quality.aql.selectOption", "선택")}</option>
                  {activeAqlOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </HelpField>
            </div>

            <div className="mt-3 flex-1 min-h-0">
              <DataGrid
                data={policies}
                columns={policyColumns}
                pageSize={20}
                getRowId={(row) => row.policyCode}
                selectedRowId={selectedPolicy?.policyCode}
                onRowClick={loadPolicy}
                enableColumnFilter
                sqlQuery={`SELECT POLICY_CODE, POLICY_NAME, INSPECTION_LEVEL, MAJOR_AQL_CODE, MINOR_AQL_CODE, USE_YN\nFROM IQC_AQL_POLICIES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY POLICY_CODE`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-7 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 overflow-auto">
            <div className="mb-4 h-72">
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
                exportFileName={t("quality.aql.title", "AQL 기준관리")}
                toolbarLeft={
                  <Input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder={t("quality.aql.searchPlaceholder", "AQL 코드/명칭 검색")}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                }
                sqlQuery={`SELECT AQL_CODE, AQL_NAME, INSPECTION_LEVEL, AQL_VALUE, USE_YN\nFROM AQL_STANDARDS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY AQL_CODE`}
              />
            </div>

            <div className="mb-4">
              <h2 className="text-sm font-semibold text-text">{selected ? t("quality.aql.editStandard", "AQL 기준 수정") : t("quality.aql.registerStandard", "AQL 기준 등록")}</h2>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <HelpField field="aqlCode" label={t("quality.aql.aqlCode", "AQL 코드")} required>
                <Input value={form.aqlCode}
                  disabled={!!selected}
                  onChange={(event) => setField("aqlCode", event.target.value)}
                  placeholder="AQL-1.0" fullWidth />
              </HelpField>
              <HelpField field="aqlName" label={t("quality.aql.aqlName", "AQL 명칭")} required>
                <Input value={form.aqlName}
                  onChange={(event) => setField("aqlName", event.target.value)}
                  placeholder={t("quality.aql.aqlNamePlaceholder", "일반검사 AQL 1.0")} fullWidth />
              </HelpField>
              <HelpField field="inspectionLevel" label={t("quality.aql.inspectionLevel", "검사수준")}>
                <ComCodeSelect groupCode="AQL_INSP_LEVEL" includeAll={false}
                  value={form.inspectionLevel ?? ""}
                  onChange={(value) => setField("inspectionLevel", value)} fullWidth />
              </HelpField>
              <HelpField field="aqlValue" label={t("quality.aql.aqlValue", "AQL 값")}>
                <ComCodeSelect groupCode="AQL_VALUE" includeAll={false}
                  value={form.aqlValue == null ? "" : String(form.aqlValue)}
                  onChange={(value) => setField("aqlValue", value === "" ? 0 : Number(value))} fullWidth />
              </HelpField>
              <HelpField field="useYn" label={t("quality.aql.useYn", "사용여부")}>
                <ComCodeSelect groupCode="USE_YN" includeAll={false}
                  value={form.useYn} onChange={(value) => setField("useYn", value)} fullWidth />
              </HelpField>
              <HelpField field="remark" label={t("quality.aql.remark", "비고")} className="col-span-3">
                <Input value={form.remark ?? ""}
                  onChange={(event) => setField("remark", event.target.value)}
                  fullWidth />
              </HelpField>
            </div>

            <div className="mt-5 mb-2">
              <h3 className="text-sm font-semibold text-text">{t("quality.aql.ruleSection")}</h3>
            </div>

            <div className="mt-2 rounded border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_36px] bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-text">
                <div className="px-2 py-1.5"><HelpHeader field="lotQtyFrom" label="lotQtyFrom" /></div>
                <div className="px-2 py-1.5"><HelpHeader field="lotQtyTo" label="lotQtyTo" /></div>
                <div className="px-2 py-1.5"><HelpHeader field="sampleSize" label="sampleSize" /></div>
                <div className="px-2 py-1.5"><HelpHeader field="acceptQty" label="acceptQty" /></div>
                <div className="px-2 py-1.5"><HelpHeader field="rejectQty" label="rejectQty" /></div>
                <div />
              </div>
              {(form.rules ?? []).map((rule, index) => (
                <div key={`${rule.lotQtyFrom}-${index}`} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_36px] border-t border-border bg-surface/60">
                  <div className="p-1"><QtyInput value={rule.lotQtyFrom} onChange={(n) => setRuleField(index, "lotQtyFrom", n || 1)} className="!h-8 !px-2" fullWidth /></div>
                  <div className="p-1"><QtyInput value={rule.lotQtyTo} onChange={(n) => setRuleField(index, "lotQtyTo", n || 1)} className="!h-8 !px-2" fullWidth /></div>
                  <div className="p-1"><QtyInput value={rule.sampleSize} onChange={(n) => setRuleField(index, "sampleSize", n)} className="!h-8 !px-2" fullWidth /></div>
                  <div className="p-1"><QtyInput value={rule.acceptQty} onChange={(n) => setRuleField(index, "acceptQty", n)} className="!h-8 !px-2" fullWidth /></div>
                  <div className="p-1"><QtyInput value={rule.rejectQty} onChange={(n) => setRuleField(index, "rejectQty", n)} className="!h-8 !px-2" fullWidth /></div>
                  <div className="p-1 flex items-center justify-center">
                    <button className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" onClick={() => removeRule(index)} title={t("common.delete", "삭제")}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(form.rules ?? []).length === 0 && (
                <div className="p-6 text-sm text-text-muted text-center">{t("quality.aql.ruleEmpty", "LOT 수량별 판정기준을 추가하세요.")}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("quality.aql.disableStandardTitle", "AQL 기준 사용중지")}
        message={t("quality.aql.disableStandardMsg", "{{code}} 기준을 사용중지하시겠습니까?", { code: selected?.aqlCode ?? "" })}
      />
      <ConfirmModal
        isOpen={policyDeleteOpen}
        onClose={() => setPolicyDeleteOpen(false)}
        onConfirm={handlePolicyDelete}
        title={t("quality.aql.disablePolicyTitle", "AQL 정책 사용중지")}
        message={t("quality.aql.disablePolicyMsg", "{{code}} 정책을 사용중지하시겠습니까?", { code: selectedPolicy?.policyCode ?? "" })}
      />
    </div>
  );
}
