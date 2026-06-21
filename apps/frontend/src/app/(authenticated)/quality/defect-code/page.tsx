"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { AlertTriangle, Plus, RefreshCw, Save } from "lucide-react";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

interface DefectCategory {
  categoryCode: string;
  categoryName: string;
  levelNo: number;
  parentCategoryCode?: string | null;
  sortOrder?: number;
  useYn: string;
  description?: string | null;
  children?: DefectCategory[];
}

interface DefectCode {
  defectCode: string;
  defectName: string;
  categoryCode: string;
  defectGrade: "CRITICAL" | "MAJOR" | "MINOR";
  defectScope: "RAW_MATERIAL" | "PRODUCT" | "PROCESS" | "COMMON";
  productTypes: string[];
  description?: string | null;
  sortOrder?: number;
  useYn: string;
}

const emptyCategory: DefectCategory = {
  categoryCode: "",
  categoryName: "",
  levelNo: 1,
  parentCategoryCode: null,
  sortOrder: 0,
  useYn: "Y",
  description: "",
};

const emptyCode: DefectCode = {
  defectCode: "",
  defectName: "",
  categoryCode: "",
  defectGrade: "MAJOR",
  defectScope: "COMMON",
  productTypes: [],
  description: "",
  sortOrder: 0,
  useYn: "Y",
};

function flattenCategories(nodes: DefectCategory[]): DefectCategory[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children ?? [])]);
}

function CategoryNode({
  node,
  selectedCode,
  onSelect,
}: {
  node: DefectCategory;
  selectedCode: string;
  onSelect: (node: DefectCategory) => void;
}) {
  const { t } = useTranslation();
  const isSelected = selectedCode === node.categoryCode;
  const levelTone = node.levelNo === 1
    ? "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
    : node.levelNo === 2
      ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";

  return (
    <div className="relative" style={{ marginLeft: `${(node.levelNo - 1) * 14}px` }}>
      {node.levelNo > 1 && <div className="absolute -left-2 top-0 h-full border-l-2 border-border/70" />}
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={`mb-1 flex min-h-[54px] w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
          isSelected
            ? "border-primary bg-primary/10 shadow-sm"
            : "border-transparent text-text hover:border-border hover:bg-surface-hover"
        }`}
      >
        <span className={`mt-0.5 inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded border px-1.5 text-[11px] font-semibold ${levelTone}`}>
          {t("quality.defectCode.levelBadge", "{{level}}레벨", { level: node.levelNo })}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm leading-5 ${isSelected ? "font-semibold text-primary" : "font-medium text-text"}`}>
            {node.categoryName}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] leading-4 text-text-muted">
            {node.categoryCode}
          </span>
        </span>
      </button>
      {(node.children ?? []).map((child) => (
        <CategoryNode key={child.categoryCode} node={child} selectedCode={selectedCode} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function DefectCodeMasterPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<DefectCategory[]>([]);
  const [codes, setCodes] = useState<DefectCode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DefectCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<DefectCategory>(emptyCategory);
  const [selectedCode, setSelectedCode] = useState<DefectCode | null>(null);
  const [codeForm, setCodeForm] = useState<DefectCode>(emptyCode);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const productTypeOptions = useComCodeOptions("PRODUCT_TYPE", false, true);
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const leafCategoryOptions = useMemo(
    () => flatCategories
      .filter((category) => category.levelNo === 3 && category.useYn === "Y")
      .map((category) => ({ value: category.categoryCode, label: `${category.categoryCode} - ${category.categoryName}` })),
    [flatCategories],
  );

  const parentCategoryOptions = useMemo(
    () => flatCategories
      .filter((category) => category.levelNo === categoryForm.levelNo - 1 && category.useYn === "Y")
      .map((category) => ({ value: category.categoryCode, label: `${category.categoryCode} - ${category.categoryName}` })),
    [categoryForm.levelNo, flatCategories],
  );

  const formatDefectGrade = useCallback((grade: DefectCode["defectGrade"]) => {
    const labels: Record<DefectCode["defectGrade"], string> = {
      CRITICAL: t("quality.defectCode.gradeCritical", "치명"),
      MAJOR: t("quality.defectCode.gradeMajor", "중"),
      MINOR: t("quality.defectCode.gradeMinor", "경"),
    };
    return labels[grade] ?? grade;
  }, [t]);

  const formatDefectScope = useCallback((scope: DefectCode["defectScope"]) => {
    const labels: Record<DefectCode["defectScope"], string> = {
      COMMON: t("quality.defectCode.scopeCommon", "공통"),
      RAW_MATERIAL: t("quality.defectCode.scopeRawMaterial", "원자재"),
      PRODUCT: t("quality.defectCode.scopeProduct", "제품"),
      PROCESS: t("quality.defectCode.scopeProcess", "공정"),
    };
    return labels[scope] ?? scope;
  }, [t]);

  const defectGradeOptions = useMemo(
    () => (["CRITICAL", "MAJOR", "MINOR"] as const).map((value) => ({ value, label: formatDefectGrade(value) })),
    [formatDefectGrade],
  );

  const defectScopeOptions = useMemo(
    () => (["COMMON", "RAW_MATERIAL", "PRODUCT", "PROCESS"] as const).map((value) => ({ value, label: formatDefectScope(value) })),
    [formatDefectScope],
  );

  const fetchCategories = useCallback(async () => {
    const res = await api.get("/quality/defect-codes/categories");
    const data = res.data?.data ?? [];
    setCategories(data);
    const flat = flattenCategories(data);
    if (!selectedCategory && flat.length) {
      setSelectedCategory(flat[0]);
      setCategoryForm(flat[0]);
    }
  }, [selectedCategory]);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory?.levelNo === 3) params.categoryCode = selectedCategory.categoryCode;
      const res = await api.get("/quality/defect-codes", { params });
      setCodes(res.data?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const resetCategoryForm = useCallback((levelNo = 1, parentCategoryCode: string | null = null) => {
    setSelectedCategory(null);
    setCategoryForm({ ...emptyCategory, levelNo, parentCategoryCode });
  }, []);

  const resetCodeForm = useCallback(() => {
    setSelectedCode(null);
    setCodeForm({
      ...emptyCode,
      categoryCode: selectedCategory?.levelNo === 3 ? selectedCategory.categoryCode : "",
    });
  }, [selectedCategory]);

  const handleCategorySelect = useCallback((category: DefectCategory) => {
    setSelectedCategory(category);
    setCategoryForm({ ...category });
    setSelectedCode(null);
    setCodeForm({ ...emptyCode, categoryCode: category.levelNo === 3 ? category.categoryCode : "" });
  }, []);

  const handleCodeSelect = useCallback((row: DefectCode) => {
    setSelectedCode(row);
    setCodeForm({ ...row, productTypes: row.productTypes ?? [] });
  }, []);

  const saveCategory = useCallback(async () => {
    if (!categoryForm.categoryCode.trim() || !categoryForm.categoryName.trim()) {
      toast.error(t("quality.defectCode.requiredCategory", "분류 코드와 분류명을 입력하세요."));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...categoryForm,
        categoryCode: categoryForm.categoryCode.trim().toUpperCase(),
        parentCategoryCode: categoryForm.levelNo === 1 ? null : categoryForm.parentCategoryCode,
      };
      if (selectedCategory) {
        await api.put(`/quality/defect-codes/categories/${encodeURIComponent(selectedCategory.categoryCode)}`, payload);
      } else {
        await api.post("/quality/defect-codes/categories", payload);
      }
      await fetchCategories();
    } finally {
      setSaving(false);
    }
  }, [categoryForm, fetchCategories, selectedCategory, t]);

  const saveCode = useCallback(async () => {
    if (!codeForm.defectCode.trim() || !codeForm.defectName.trim() || !codeForm.categoryCode) {
      toast.error(t("quality.defectCode.requiredCode", "불량코드, 불량명, 3레벨 분류를 입력하세요."));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...codeForm,
        defectCode: codeForm.defectCode.trim().toUpperCase(),
        categoryCode: codeForm.categoryCode.trim().toUpperCase(),
      };
      if (selectedCode) {
        await api.put(`/quality/defect-codes/${encodeURIComponent(selectedCode.defectCode)}`, payload);
      } else {
        await api.post("/quality/defect-codes", payload);
      }
      await fetchCodes();
    } finally {
      setSaving(false);
    }
  }, [codeForm, fetchCodes, selectedCode, t]);

  const setProductType = useCallback((productType: string, checked: boolean) => {
    setCodeForm((prev) => ({
      ...prev,
      productTypes: checked
        ? [...new Set([...prev.productTypes, productType])]
        : prev.productTypes.filter((value) => value !== productType),
    }));
  }, []);

  return (
    <div className="h-full min-h-0 overflow-hidden p-6 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text">
            <AlertTriangle className="h-7 w-7 text-primary" />
            {t("quality.defectCode.title", "불량코드관리")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">{t("quality.defectCode.subtitle", "3레벨 분류와 제품류별 불량코드를 관리합니다.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { fetchCategories(); fetchCodes(); }}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={resetCodeForm}>
            <Plus className="h-4 w-4" />{t("quality.defectCode.addCode", "불량코드 추가")}
          </Button>
        </div>
      </div>

      <div className="grid h-[calc(100vh-150px)] grid-cols-[340px_minmax(420px,1fr)_420px] gap-4">
        <Card padding="none" className="min-h-0 overflow-hidden">
          <CardContent className="flex h-full flex-col p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">{t("quality.defectCode.category", "불량분류")}</h2>
              <div className="flex gap-1">
                <button className="rounded px-2 py-1 text-xs hover:bg-surface-hover" onClick={() => resetCategoryForm(1, null)}>L1</button>
                <button className="rounded px-2 py-1 text-xs hover:bg-surface-hover" onClick={() => resetCategoryForm(2, selectedCategory?.categoryCode ?? null)}>L2</button>
                <button className="rounded px-2 py-1 text-xs hover:bg-surface-hover" onClick={() => resetCategoryForm(3, selectedCategory?.categoryCode ?? null)}>L3</button>
              </div>
            </div>
            <div data-testid="defect-category-tree" className="min-h-0 flex-1 overflow-auto pr-1">
              {categories.map((node) => (
                <CategoryNode key={node.categoryCode} node={node} selectedCode={selectedCategory?.categoryCode ?? ""} onSelect={handleCategorySelect} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card padding="none" className="min-h-0 overflow-hidden">
          <CardContent className="flex h-full flex-col p-3">
            <div className="mb-3 grid grid-cols-[1fr_150px_120px] gap-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("quality.defectCode.search", "불량코드/불량명 검색")} fullWidth />
              <ComCodeSelect groupCode="DEFECT_GRADE" value="" onChange={() => undefined} disabled includeAll />
              <Button variant="secondary" onClick={fetchCodes}>{t("common.search", "검색")}</Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-200 text-xs text-text dark:bg-slate-800">
                  <tr>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.defectCode", "불량코드")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.defectName", "불량명")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.category", "분류")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.grade", "등급")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.scope", "적용범위")}</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((row) => (
                    <tr
                      key={row.defectCode}
                      onClick={() => handleCodeSelect(row)}
                      className={`cursor-pointer border-t border-border hover:bg-surface-hover ${selectedCode?.defectCode === row.defectCode ? "bg-primary/10" : ""}`}
                    >
                      <td className="px-2 py-2 font-mono text-xs font-semibold text-primary">{row.defectCode}</td>
                      <td className="px-2 py-2">{row.defectName}</td>
                      <td className="px-2 py-2 font-mono text-xs">{row.categoryCode}</td>
                      <td className="px-2 py-2">{formatDefectGrade(row.defectGrade)}</td>
                      <td className="px-2 py-2">{formatDefectScope(row.defectScope)}</td>
                    </tr>
                  ))}
                  {!codes.length && (
                    <tr><td colSpan={5} className="px-2 py-10 text-center text-text-muted">{t("common.noData", "데이터가 없습니다.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
          <Card padding="none" className="overflow-hidden">
            <CardContent className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">{selectedCategory ? t("quality.defectCode.editCategory", "분류 수정") : t("quality.defectCode.addCategory", "분류 추가")}</h2>
                <Button size="sm" onClick={saveCategory} isLoading={saving}>
                  <Save className="h-4 w-4" />{t("common.save")}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label={t("quality.defectCode.level", "분류 레벨")} type="number" min={1} max={3} value={String(categoryForm.levelNo)} onChange={(event) => setCategoryForm((prev) => ({ ...prev, levelNo: Number(event.target.value) || 1, parentCategoryCode: null }))} fullWidth />
                <Select label={t("quality.defectCode.parentCategory", "상위 분류")} value={categoryForm.parentCategoryCode ?? ""} onChange={(value) => setCategoryForm((prev) => ({ ...prev, parentCategoryCode: value || null }))} options={[{ value: "", label: "-" }, ...parentCategoryOptions]} disabled={categoryForm.levelNo === 1} fullWidth />
                <Input label={t("quality.defectCode.categoryCode", "분류코드")} value={categoryForm.categoryCode} onChange={(event) => setCategoryForm((prev) => ({ ...prev, categoryCode: event.target.value.toUpperCase() }))} disabled={!!selectedCategory} required fullWidth />
                <Input label={t("quality.defectCode.categoryName", "분류명")} value={categoryForm.categoryName} onChange={(event) => setCategoryForm((prev) => ({ ...prev, categoryName: event.target.value }))} required fullWidth />
              </div>
            </CardContent>
          </Card>

          <Card padding="none" className="min-h-0 overflow-auto">
            <CardContent className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">{selectedCode ? t("quality.defectCode.editCode", "불량코드 수정") : t("quality.defectCode.addCode", "불량코드 추가")}</h2>
                <Button size="sm" onClick={saveCode} isLoading={saving}>
                  <Save className="h-4 w-4" />{t("common.save")}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label={t("quality.defectCode.defectCode", "불량코드")} value={codeForm.defectCode} onChange={(event) => setCodeForm((prev) => ({ ...prev, defectCode: event.target.value.toUpperCase() }))} disabled={!!selectedCode} required fullWidth />
                <Input label={t("quality.defectCode.defectName", "불량명")} value={codeForm.defectName} onChange={(event) => setCodeForm((prev) => ({ ...prev, defectName: event.target.value }))} required fullWidth />
                <Select label={t("quality.defectCode.categoryCode", "분류코드")} value={codeForm.categoryCode} onChange={(value) => setCodeForm((prev) => ({ ...prev, categoryCode: value }))} options={[{ value: "", label: t("quality.defectCode.selectCategory", "분류 선택") }, ...leafCategoryOptions]} required fullWidth />
                <Select label={t("quality.defectCode.grade", "등급")} value={codeForm.defectGrade} onChange={(value) => setCodeForm((prev) => ({ ...prev, defectGrade: value as DefectCode["defectGrade"] }))} options={defectGradeOptions} required fullWidth />
                <Select label={t("quality.defectCode.scope", "적용범위")} value={codeForm.defectScope} onChange={(value) => setCodeForm((prev) => ({ ...prev, defectScope: value as DefectCode["defectScope"] }))} options={defectScopeOptions} required fullWidth />
                <ComCodeSelect groupCode="USE_YN" includeAll={false} label={t("quality.defectCode.useYn", "사용여부")} value={codeForm.useYn} onChange={(value) => setCodeForm((prev) => ({ ...prev, useYn: value }))} fullWidth />
                <div className="col-span-2">
                  <Input label={t("quality.defectCode.description", "설명")} value={codeForm.description ?? ""} onChange={(event) => setCodeForm((prev) => ({ ...prev, description: event.target.value }))} fullWidth />
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold text-text">{t("quality.defectCode.productTypes", "제품류")}</div>
                <div className="grid grid-cols-2 gap-2">
                  {productTypeOptions.map((option) => (
                    <label key={option.value} className="flex h-8 items-center gap-2 rounded border border-border px-2 text-sm">
                      <input
                        type="checkbox"
                        checked={codeForm.productTypes.includes(option.value)}
                        onChange={(event) => setProductType(option.value, event.target.checked)}
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
