"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { AlertTriangle, Plus, RefreshCw, Save } from "lucide-react";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
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

function modelGroupFromLevel2Code(level1Code: string, level2Code: string) {
  const prefix = `${level1Code}_`;
  return level1Code && level2Code.startsWith(prefix) ? level2Code.slice(prefix.length) : "";
}

export default function DefectCodeMasterPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<DefectCategory[]>([]);
  const [codes, setCodes] = useState<DefectCode[]>([]);
  const [categoryForm, setCategoryForm] = useState<DefectCategory>(emptyCategory);
  const [selectedCode, setSelectedCode] = useState<DefectCode | null>(null);
  const [codeForm, setCodeForm] = useState<DefectCode>(emptyCode);
  const [selectedLevel1, setSelectedLevel1] = useState("");
  const [selectedLevel2, setSelectedLevel2] = useState("");
  const [selectedLevel3, setSelectedLevel3] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const categoryByCode = useMemo(() => new Map(flatCategories.map((category) => [category.categoryCode, category])), [flatCategories]);

  const level1Options = useMemo(
    () => flatCategories
      .filter((category) => category.levelNo === 1 && category.useYn === "Y")
      .map((category) => ({ value: category.categoryCode, label: `${category.categoryCode} - ${category.categoryName}` })),
    [flatCategories],
  );

  const level2Options = useMemo(
    () => flatCategories
      .filter((category) => category.levelNo === 2 && category.parentCategoryCode === selectedLevel1 && category.useYn === "Y")
      .map((category) => ({ value: category.categoryCode, label: `${category.categoryCode} - ${category.categoryName}` })),
    [flatCategories, selectedLevel1],
  );

  const level3Options = useMemo(
    () => flatCategories
      .filter((category) => category.levelNo === 3 && category.parentCategoryCode === selectedLevel2 && category.useYn === "Y")
      .map((category) => ({ value: category.categoryCode, label: `${category.categoryCode} - ${category.categoryName}` })),
    [flatCategories, selectedLevel2],
  );

  const categoryParentOptions = useMemo(
    () => flatCategories
      .filter((category) => category.levelNo === categoryForm.levelNo - 1 && category.useYn === "Y")
      .map((category) => ({ value: category.categoryCode, label: `${category.categoryCode} - ${category.categoryName}` })),
    [categoryForm.levelNo, flatCategories],
  );

  const categoryLevels = useCallback((categoryCode: string) => {
    const levels = { level1: "", level2: "", level3: "" };
    let current = categoryByCode.get(categoryCode);
    while (current) {
      if (current.levelNo === 1) levels.level1 = current.categoryName;
      if (current.levelNo === 2) levels.level2 = current.categoryName;
      if (current.levelNo === 3) levels.level3 = current.categoryName;
      current = current.parentCategoryCode ? categoryByCode.get(current.parentCategoryCode) : undefined;
    }
    if (!levels.level3 && categoryCode) levels.level3 = categoryCode;
    return levels;
  }, [categoryByCode]);

  const setSelectedCategoryPath = useCallback((categoryCode: string) => {
    const level3 = categoryByCode.get(categoryCode);
    const level2 = level3?.parentCategoryCode ? categoryByCode.get(level3.parentCategoryCode) : undefined;
    const level1 = level2?.parentCategoryCode ? categoryByCode.get(level2.parentCategoryCode) : undefined;
    setSelectedLevel1(level1?.categoryCode ?? "");
    setSelectedLevel2(level2?.categoryCode ?? "");
    setSelectedLevel3(level3?.categoryCode ?? "");
  }, [categoryByCode]);

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

  const formatUseYn = useCallback((useYn: string) => (
    useYn === "Y" ? t("common.use", "사용") : t("common.inactive", "비활성")
  ), [t]);

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
    setCategories(res.data?.data ?? []);
  }, []);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/quality/defect-codes", { params });
      setCodes(res.data?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  useEffect(() => {
    setCodeForm((prev) => ({ ...prev, categoryCode: selectedLevel3 }));
  }, [selectedLevel3]);

  const resetCodeForm = useCallback(() => {
    setSelectedCode(null);
    setCodeForm(emptyCode);
    setSelectedLevel1("");
    setSelectedLevel2("");
    setSelectedLevel3("");
  }, []);

  const handleCodeSelect = useCallback((row: DefectCode) => {
    setSelectedCode(row);
    setCodeForm({ ...row, productTypes: row.productTypes ?? [] });
    setSelectedCategoryPath(row.categoryCode);
  }, [setSelectedCategoryPath]);

  const saveCategory = useCallback(async () => {
    if (!categoryForm.categoryCode.trim() || !categoryForm.categoryName.trim()) {
      toast.error(t("quality.defectCode.requiredCategory", "분류 코드와 분류명을 입력하세요."));
      return;
    }
    setSaving(true);
    try {
      await api.post("/quality/defect-codes/categories", {
        ...categoryForm,
        categoryCode: categoryForm.categoryCode.trim().toUpperCase(),
        parentCategoryCode: categoryForm.levelNo === 1 ? null : categoryForm.parentCategoryCode,
      });
      setCategoryForm(emptyCategory);
      await fetchCategories();
    } finally {
      setSaving(false);
    }
  }, [categoryForm, fetchCategories, t]);

  const saveCode = useCallback(async () => {
    if (!codeForm.defectCode.trim() || !codeForm.defectName.trim() || !selectedLevel3) {
      toast.error(t("quality.defectCode.requiredCode", "불량코드, 불량명, 3레벨 분류를 입력하세요."));
      return;
    }
    setSaving(true);
    try {
      const selectedModelGroup = modelGroupFromLevel2Code(selectedLevel1, selectedLevel2);
      const payload = {
        ...codeForm,
        defectCode: codeForm.defectCode.trim().toUpperCase(),
        categoryCode: selectedLevel3,
        productTypes: selectedModelGroup ? [selectedModelGroup] : [],
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
  }, [codeForm, fetchCodes, selectedCode, selectedLevel1, selectedLevel2, selectedLevel3, t]);

  return (
    <div className="h-full min-h-0 overflow-hidden p-6 animate-fade-in flex flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text">
            <AlertTriangle className="h-7 w-7 text-primary" />
            {t("quality.defectCode.title", "불량코드관리")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">{t("quality.defectCode.subtitle", "검사단계, 모델구분, 불량유형으로 불량코드를 관리합니다.")}</p>
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

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(620px,1fr)_440px] gap-4">
        <Card padding="none" className="min-h-0 overflow-hidden">
          <CardContent className="flex h-full flex-col p-3">
            <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <h2 className="text-sm font-semibold text-text">{t("quality.defectCode.allCodes", "등록된 불량 전체")}</h2>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("quality.defectCode.search", "불량코드/불량명 검색")} fullWidth />
              <Button variant="secondary" onClick={fetchCodes}>{t("common.search", "검색")}</Button>
            </div>
            <div data-testid="defect-code-grid" className="min-h-0 flex-1 overflow-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-200 text-xs text-text dark:bg-slate-800">
                  <tr>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.defectCode", "불량코드")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.defectName", "불량명")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.level1", "1레벨")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.level2", "2레벨")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.level3", "3레벨")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.grade", "등급")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.scope", "적용범위")}</th>
                    <th className="px-2 py-2 text-left">{t("quality.defectCode.useYn", "사용여부")}</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((row) => {
                    const levels = categoryLevels(row.categoryCode);
                    return (
                      <tr
                        key={row.defectCode}
                        onClick={() => handleCodeSelect(row)}
                        className={`cursor-pointer border-t border-border hover:bg-surface-hover ${selectedCode?.defectCode === row.defectCode ? "bg-primary/10" : ""}`}
                      >
                        <td className="px-2 py-2 font-mono text-xs font-semibold text-primary">{row.defectCode}</td>
                        <td className="px-2 py-2">{row.defectName}</td>
                        <td className="px-2 py-2 text-xs text-text-muted">{levels.level1}</td>
                        <td className="px-2 py-2 text-xs text-text-muted">{levels.level2}</td>
                        <td className="px-2 py-2 text-xs text-text-muted">{levels.level3}</td>
                        <td className="px-2 py-2">{formatDefectGrade(row.defectGrade)}</td>
                        <td className="px-2 py-2">{formatDefectScope(row.defectScope)}</td>
                        <td className="px-2 py-2">{formatUseYn(row.useYn)}</td>
                      </tr>
                    );
                  })}
                  {!codes.length && (
                    <tr><td colSpan={8} className="px-2 py-10 text-center text-text-muted">{t("common.noData", "데이터가 없습니다.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-rows-[1fr_auto] gap-4">
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
                <Select label={t("quality.defectCode.level1", "1레벨")} value={selectedLevel1} onChange={(value) => { setSelectedLevel1(value); setSelectedLevel2(""); setSelectedLevel3(""); }} options={[{ value: "", label: t("quality.defectCode.selectLevel1", "1레벨 선택") }, ...level1Options]} required fullWidth />
                <Select label={t("quality.defectCode.level2", "2레벨")} value={selectedLevel2} onChange={(value) => { setSelectedLevel2(value); setSelectedLevel3(""); }} options={[{ value: "", label: t("quality.defectCode.selectLevel2", "2레벨 선택") }, ...level2Options]} disabled={!selectedLevel1} required fullWidth />
                <Select label={t("quality.defectCode.level3", "3레벨")} value={selectedLevel3} onChange={setSelectedLevel3} options={[{ value: "", label: t("quality.defectCode.selectLevel3", "3레벨 선택") }, ...level3Options]} disabled={!selectedLevel2} required fullWidth />
                <Select label={t("quality.defectCode.grade", "등급")} value={codeForm.defectGrade} onChange={(value) => setCodeForm((prev) => ({ ...prev, defectGrade: value as DefectCode["defectGrade"] }))} options={defectGradeOptions} required fullWidth />
                <Select label={t("quality.defectCode.scope", "적용범위")} value={codeForm.defectScope} onChange={(value) => setCodeForm((prev) => ({ ...prev, defectScope: value as DefectCode["defectScope"] }))} options={defectScopeOptions} required fullWidth />
                <ComCodeSelect groupCode="USE_YN" includeAll={false} label={t("quality.defectCode.useYn", "사용여부")} value={codeForm.useYn} onChange={(value) => setCodeForm((prev) => ({ ...prev, useYn: value }))} fullWidth />
                <div className="col-span-2">
                  <Input label={t("quality.defectCode.description", "설명")} value={codeForm.description ?? ""} onChange={(event) => setCodeForm((prev) => ({ ...prev, description: event.target.value }))} fullWidth />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <CardContent className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">{t("quality.defectCode.quickCategoryAdd", "분류 빠른 추가")}</h2>
                <Button size="sm" variant="secondary" onClick={saveCategory} isLoading={saving}>
                  <Save className="h-4 w-4" />{t("common.save")}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select label={t("quality.defectCode.level", "분류 레벨")} value={String(categoryForm.levelNo)} onChange={(value) => setCategoryForm((prev) => ({ ...prev, levelNo: Number(value) || 1, parentCategoryCode: null }))} options={[
                  { value: "1", label: t("quality.defectCode.level1", "1레벨") },
                  { value: "2", label: t("quality.defectCode.level2", "2레벨") },
                  { value: "3", label: t("quality.defectCode.level3", "3레벨") },
                ]} fullWidth />
                <Select label={t("quality.defectCode.parentCategory", "상위 분류")} value={categoryForm.parentCategoryCode ?? ""} onChange={(value) => setCategoryForm((prev) => ({ ...prev, parentCategoryCode: value || null }))} options={[{ value: "", label: "-" }, ...categoryParentOptions]} disabled={categoryForm.levelNo === 1} fullWidth />
                <Input label={t("quality.defectCode.categoryCode", "분류코드")} value={categoryForm.categoryCode} onChange={(event) => setCategoryForm((prev) => ({ ...prev, categoryCode: event.target.value.toUpperCase() }))} required fullWidth />
                <Input label={t("quality.defectCode.categoryName", "분류명")} value={categoryForm.categoryName} onChange={(event) => setCategoryForm((prev) => ({ ...prev, categoryName: event.target.value }))} required fullWidth />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
