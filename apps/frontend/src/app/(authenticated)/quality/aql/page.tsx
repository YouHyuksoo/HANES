"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ClipboardList, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { Button, Card, CardContent, ConfirmModal, Input } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { HelpField } from "./components/AqlFieldHelp";
import {
  createAqlGridColumns,
  createAqlPolicyGridColumns,
  type AqlStandard,
  type IqcAqlPolicy,
} from "./aqlColumns";

interface AqlCodeLetterRule {
  [key: string]: unknown;
  inspectionLevel: string;
  lotQtyFrom: number;
  lotQtyTo: number;
  codeLetter: string;
}

interface AqlCodeLetterSample {
  [key: string]: unknown;
  codeLetter: string;
  sampleSize: number;
}

interface AqlAcceptanceRule {
  [key: string]: unknown;
  codeLetter: string;
  aqlValue: number;
  sampleCodeLetter: string;
  acceptQty: number;
  rejectQty: number;
}

type AqlTab = "policies" | "standards" | "codeLetters" | "samplingPlan";

const emptyForm: AqlStandard = {
  aqlCode: "",
  aqlName: "",
  inspectionLevel: "II",
  aqlValue: 1,
  useYn: "Y",
  remark: "",
  rules: [],
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

const GENERAL_INSPECTION_LEVELS = ["I", "II", "III"];
const SPECIAL_INSPECTION_LEVELS = ["S1", "S2", "S3", "S4"];
const SAMPLE_CODE_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R"];
const BASE_AQL_COLUMNS = [
  { value: 0.065, label: "0.065" },
  { value: 0.10, label: "0.10" },
  { value: 0.15, label: "0.15" },
  { value: 0.25, label: "0.25" },
  { value: 0.40, label: "0.40" },
  { value: 0.65, label: "0.65" },
  { value: 1.0, label: "1.0" },
  { value: 1.5, label: "1.5" },
  { value: 2.5, label: "2.5" },
  { value: 4.0, label: "4.0" },
  { value: 6.5, label: "6.5" },
];

function normalizeAqlKey(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

function formatAqlLabel(value: number) {
  const base = BASE_AQL_COLUMNS.find((column) => normalizeAqlKey(column.value) === normalizeAqlKey(value));
  if (base) return base.label;
  return value < 1 ? value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatLotRange(from: number, to: number) {
  if (to >= 999999999) return `${from.toLocaleString()} and over`;
  return `${from.toLocaleString()} to ${to.toLocaleString()}`;
}

function codeOrder(code: string) {
  const index = SAMPLE_CODE_ORDER.indexOf(code);
  return index === -1 ? SAMPLE_CODE_ORDER.length : index;
}

function sampleCodeMarker(currentCode: string, targetCode: string) {
  if (!targetCode || targetCode === currentCode) return "";
  return codeOrder(targetCode) < codeOrder(currentCode) ? `↑${targetCode}` : `↓${targetCode}`;
}

function IsoCodeLetterMatrix({ rules }: { rules: AqlCodeLetterRule[] }) {
  const rows = Array.from(
    new Map(
      rules
        .map((rule) => [`${rule.lotQtyFrom}-${rule.lotQtyTo}`, { lotQtyFrom: rule.lotQtyFrom, lotQtyTo: rule.lotQtyTo }] as const)
        .sort((a, b) => a[1].lotQtyFrom - b[1].lotQtyFrom),
    ).values(),
  );
  const codeMap = new Map(rules.map((rule) => [`${rule.lotQtyFrom}-${rule.lotQtyTo}-${rule.inspectionLevel}`, rule.codeLetter]));
  const levels = [...GENERAL_INSPECTION_LEVELS, ...SPECIAL_INSPECTION_LEVELS];

  return (
    <div className="h-full overflow-auto rounded border border-amber-500/40 bg-surface" data-iso-code-letter-matrix data-source-table="AQL_CODE_LETTER_RULES">
      <table className="min-w-[860px] w-full border-collapse text-center text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <th colSpan={8} className="bg-amber-500 px-3 py-2 text-base font-bold uppercase tracking-normal text-white">
              SAMPLE SIZE CODE LETTERS
            </th>
          </tr>
          <tr className="bg-surface text-text">
            <th rowSpan={2} className="w-40 border border-amber-400 bg-amber-500 px-3 py-2 font-semibold text-white">Lot Size</th>
            <th colSpan={3} className="border border-border px-3 py-2 font-semibold">General Inspection Levels</th>
            <th colSpan={4} className="border border-border px-3 py-2 font-semibold">Special Inspection Levels</th>
          </tr>
          <tr className="bg-surface text-amber-500">
            {levels.map((level) => (
              <th key={level} className="border border-border px-3 py-1.5 font-bold">{level}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.lotQtyFrom}-${row.lotQtyTo}`} className="hover:bg-amber-500/10">
              <th className="border border-amber-400 bg-amber-500/95 px-3 py-1.5 text-left font-semibold text-white">
                {formatLotRange(row.lotQtyFrom, row.lotQtyTo)}
              </th>
              {levels.map((level) => (
                <td key={level} className="border border-border px-3 py-1.5 font-mono text-base font-semibold text-text">
                  {codeMap.get(`${row.lotQtyFrom}-${row.lotQtyTo}-${level}`) ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IsoSamplingPlanMatrix({
  samples,
  acceptanceRules,
}: {
  samples: AqlCodeLetterSample[];
  acceptanceRules: AqlAcceptanceRule[];
}) {
  const sampleRows = [...samples].sort((a, b) => codeOrder(a.codeLetter) - codeOrder(b.codeLetter));
  const aqlColumns = Array.from(
    new Map([
      ...BASE_AQL_COLUMNS.map((column) => [normalizeAqlKey(column.value), column] as const),
      ...acceptanceRules.map((rule) => [normalizeAqlKey(rule.aqlValue), { value: rule.aqlValue, label: formatAqlLabel(rule.aqlValue) }] as const),
    ]).values(),
  ).sort((a, b) => a.value - b.value);
  const ruleMap = new Map(acceptanceRules.map((rule) => [`${rule.codeLetter}-${normalizeAqlKey(rule.aqlValue)}`, rule]));

  return (
    <div className="h-full overflow-auto rounded border border-amber-500/40 bg-surface" data-iso-sampling-plan-matrix data-source-table="AQL_CODE_LETTER_SAMPLES AQL_ACCEPTANCE_RULES">
      <table className="min-w-[1380px] w-full border-collapse text-center text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th colSpan={2 + aqlColumns.length * 2} className="bg-amber-500 px-3 py-2 text-base font-bold uppercase tracking-normal text-white">
              SINGLE SAMPLING PLANS FOR NORMAL INSPECTION
            </th>
          </tr>
          <tr className="bg-surface text-text">
            <th rowSpan={2} className="w-24 border border-amber-400 bg-amber-500 px-2 py-2 font-semibold text-white">Sample Size Code Letter</th>
            <th rowSpan={2} className="w-24 border border-amber-400 bg-amber-500 px-2 py-2 font-semibold text-white">Sample Size</th>
            <th colSpan={aqlColumns.length * 2} className="border border-border px-3 py-2 text-sm font-semibold">Acceptable Quality Levels (Normal Inspection)</th>
          </tr>
          <tr className="bg-surface text-amber-500">
            {aqlColumns.map((column) => (
              <th key={normalizeAqlKey(column.value)} colSpan={2} className="border border-border px-2 py-1 font-bold">
                <div>{column.label}</div>
                <div className="mt-0.5 grid grid-cols-2 text-[10px] uppercase text-text-muted">
                  <span>Ac</span>
                  <span>Re</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sampleRows.map((sample) => (
            <tr key={sample.codeLetter} className="hover:bg-amber-500/10">
              <th className="border border-amber-400 bg-amber-500/95 px-2 py-1.5 font-mono text-sm font-bold text-white">{sample.codeLetter}</th>
              <td className="border border-amber-400 bg-amber-500/95 px-2 py-1.5 font-mono text-sm font-semibold text-white">{sample.sampleSize.toLocaleString()}</td>
              {aqlColumns.map((column) => {
                const rule = ruleMap.get(`${sample.codeLetter}-${normalizeAqlKey(column.value)}`);
                const marker = rule ? sampleCodeMarker(sample.codeLetter, rule.sampleCodeLetter) : "";
                return (
                  <td key={`${column.value}-ac`} className="border border-border px-1.5 py-1.5 font-mono text-sm font-semibold text-text">
                    {rule ? (
                      <span className="inline-flex items-center gap-1">
                        {marker && <span className="text-[10px] text-amber-500">{marker}</span>}
                        {rule.acceptQty}
                      </span>
                    ) : ""}
                  </td>
                );
              }).flatMap((cell, index) => {
                const column = aqlColumns[index];
                const rule = ruleMap.get(`${sample.codeLetter}-${normalizeAqlKey(column.value)}`);
                return [
                  cell,
                  <td key={`${column.value}-re`} className="border border-border px-1.5 py-1.5 font-mono text-sm font-semibold text-text">
                    {rule ? rule.rejectQty : ""}
                  </td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<AqlTab>("policies");
  const [codeLetterRules, setCodeLetterRules] = useState<AqlCodeLetterRule[]>([]);
  const [codeLetterSamples, setCodeLetterSamples] = useState<AqlCodeLetterSample[]>([]);
  const [acceptanceRules, setAcceptanceRules] = useState<AqlAcceptanceRule[]>([]);

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

  const fetchIsoTables = useCallback(async () => {
    try {
      const res = await api.get("/quality/aql/iso");
      const iso = res.data?.data ?? {};
      setCodeLetterRules(iso.codeLetterRules ?? []);
      setCodeLetterSamples(iso.samples ?? []);
      setAcceptanceRules(iso.acceptanceRules ?? []);
    } catch {
      toast.error(t("quality.aql.isoLoadFailed", "ISO AQL 표 데이터를 불러오지 못했습니다."));
    }
  }, [t]);

  useEffect(() => { fetchIsoTables(); }, [fetchIsoTables]);

  useEffect(() => {
    if (activeTab === "codeLetters" || activeTab === "samplingPlan") {
      fetchIsoTables();
    }
  }, [activeTab, fetchIsoTables]);

  const refreshAll = useCallback(() => {
    fetchData();
    fetchPolicies();
    fetchIsoTables();
  }, [fetchData, fetchPolicies, fetchIsoTables]);

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

  const columns = useMemo(() => createAqlGridColumns({ t }), [t]);

  const policyColumns = useMemo(() => createAqlPolicyGridColumns({ t }), [t]);

  const tabs: Array<{ id: AqlTab; label: string }> = [
    { id: "policies", label: t("quality.aql.policySection", "AQL 정책관리") },
    { id: "standards", label: t("quality.aql.standardTab", "AQL 기준") },
    { id: "codeLetters", label: t("quality.aql.codeLetterTab", "Code Letter 표") },
    { id: "samplingPlan", label: t("quality.aql.samplingPlanTab", "Sampling Plan 표") },
  ];

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
          <Button variant="secondary" size="sm" onClick={refreshAll}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          {activeTab === "standards" && (
            <>
              <Button size="sm" onClick={handleNew}>
                <Plus className="w-4 h-4" />{t("quality.aql.addStandard", "AQL 기준 추가")}
              </Button>
              {selected && (
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4" />{t("quality.aql.disable", "사용중지")}
                </Button>
              )}
              <Button size="sm" onClick={handleSave} isLoading={saving}>
                <Save className="w-4 h-4" />{t("common.save")}
              </Button>
            </>
          )}
          {(activeTab === "codeLetters" || activeTab === "samplingPlan") && (
            <Button variant="secondary" size="sm" onClick={fetchIsoTables}>
              <RefreshCw className="w-4 h-4" />{t("quality.aql.reloadIsoTables", "표 다시읽기")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border flex-shrink-0" data-aql-tabs>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className={activeTab === "policies" ? "col-span-12 min-h-0 overflow-hidden" : "hidden"} padding="none">
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

        <Card className={activeTab === "standards" ? "col-span-12 min-h-0 overflow-hidden" : "hidden"} padding="none">
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

            <div className="mt-5 rounded border border-border bg-surface/60 p-4">
              <h3 className="text-sm font-semibold text-text">{t("quality.aql.isoRuleSection", "ISO 판정표 관리")}</h3>
              <p className="mt-1 text-sm text-text-muted">
                {t("quality.aql.isoRuleSectionDesc", "LOT 수량별 Sample Size, Ac, Re는 이 기준 화면에서 직접 입력하지 않습니다. Code Letter 표 탭에서 LOT+검사수준 기준을 관리하고, Sampling Plan 표 탭에서 Code Letter+AQL 기준의 Ac/Re를 관리합니다.")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={activeTab === "codeLetters" ? "col-span-12 min-h-0 overflow-hidden" : "hidden"} padding="none">
          <CardContent className="h-full p-4 overflow-hidden flex flex-col">
            <div className="mb-3 flex items-start justify-between gap-3 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-text">{t("quality.aql.codeLetterTable", "Sample Size Code Letters")}</h2>
                <p className="mt-0.5 text-xs text-text-muted">{t("quality.aql.codeLetterDesc", "LOT 수량과 검사수준(I, II, III, S1~S4)으로 ISO Code Letter를 결정합니다.")}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchIsoTables}>
                <RefreshCw className="w-4 h-4" />{t("common.refresh")}
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <IsoCodeLetterMatrix rules={codeLetterRules} />
            </div>
          </CardContent>
        </Card>

        <Card className={activeTab === "samplingPlan" ? "col-span-12 min-h-0 overflow-hidden" : "hidden"} padding="none">
          <CardContent className="h-full p-4 overflow-hidden flex flex-col">
            <div className="mb-3 flex items-start justify-between gap-3 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-text">{t("quality.aql.samplingPlanTable", "Single Sampling Plans for Normal Inspection")}</h2>
                <p className="mt-0.5 text-xs text-text-muted">{t("quality.aql.samplingPlanDesc", "Code Letter와 AQL 값의 교차점으로 표준 샘플수량, Ac, Re를 결정합니다. 화살표는 Sample Code Letter로 저장합니다.")}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchIsoTables}>
                <RefreshCw className="w-4 h-4" />{t("common.refresh")}
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <IsoSamplingPlanMatrix samples={codeLetterSamples} acceptanceRules={acceptanceRules} />
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
