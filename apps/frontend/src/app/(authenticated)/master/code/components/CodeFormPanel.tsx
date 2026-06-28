"use client";

/**
 * @file master/code/components/CodeFormPanel.tsx
 * @description 공통코드 추가/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **editingCode**: null이면 신규 등록, 값이 있으면 수정 모드
 * 2. **onSubmit**: 폼 데이터를 부모에 전달 → API 호출
 * 3. **onDirtyChange**: 작성 중 여부를 부모에 보고 → 행 전환 시 유실 방어
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Input, Button } from "@/components/ui";
import { UseYnSelect } from "@/components/shared";
import type { ComCodeDetail, ComCodeFormData } from "../types";

interface CodeFormPanelProps {
  onClose: () => void;
  onSubmit: (data: ComCodeFormData) => void;
  editingCode: ComCodeDetail | null;
  selectedGroup: string;
  isSubmitting: boolean;
  /** 작성 중(저장 안 됨) 여부를 부모에 보고 — 행 전환 시 유실 방어용 */
  onDirtyChange?: (dirty: boolean) => void;
  /** 슬라이드 인 애니메이션 적용 여부 (기본: true) */
  animate?: boolean;
}

/** editingCode/selectedGroup으로부터 폼 초기값 생성 */
const buildForm = (editingCode: ComCodeDetail | null, selectedGroup: string): ComCodeFormData =>
  editingCode
    ? {
        groupCode: editingCode.groupCode,
        detailCode: editingCode.detailCode,
        codeName: editingCode.codeName,
        codeDesc: editingCode.codeDesc || "",
        sortOrder: editingCode.sortOrder,
        useYn: editingCode.useYn,
        attr1: editingCode.attr1 || "",
        attr2: editingCode.attr2 || "",
        attr3: editingCode.attr3 || "",
      }
    : {
        groupCode: selectedGroup,
        detailCode: "",
        codeName: "",
        codeDesc: "",
        sortOrder: 1,
        useYn: "Y",
        attr1: "",
        attr2: "",
        attr3: "",
      };

export default function CodeFormPanel({
  onClose,
  onSubmit,
  editingCode,
  selectedGroup,
  isSubmitting,
  onDirtyChange,
  animate = true,
}: CodeFormPanelProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ComCodeFormData>(() => buildForm(editingCode, selectedGroup));
  const initialFormRef = useRef(form);

  useEffect(() => {
    const init = buildForm(editingCode, selectedGroup);
    setForm(init);
    initialFormRef.current = init;
  }, [editingCode, selectedGroup]);

  // 작성 중(저장 안 됨) 여부 계산 후 부모에 보고 — 행 전환 시 유실 방어
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form],
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleChange = (field: keyof ComCodeFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.groupCode.trim() || !form.detailCode.trim() || !form.codeName.trim()) return;
    onSubmit(form);
  };

  const isEdit = !!editingCode;

  return (
    <div className={`w-[440px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("master.code.editCode") : t("master.code.addCode")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !form.groupCode.trim() || !form.detailCode.trim() || !form.codeName.trim()}
          >
            {isSubmitting ? t("common.saving", { defaultValue: "저장중..." }) : t("common.save", "저장")}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("master.code.groupCode")}
            value={form.groupCode}
            onChange={(e) => handleChange("groupCode", e.target.value)}
            disabled={isEdit}
            required
            fullWidth
          />
          <Input
            label={t("master.code.detailCode")}
            value={form.detailCode}
            onChange={(e) => handleChange("detailCode", e.target.value.toUpperCase())}
            disabled={isEdit}
            required
            fullWidth
          />
          <Input
            label={t("master.code.codeName")}
            value={form.codeName}
            onChange={(e) => handleChange("codeName", e.target.value)}
            required
            fullWidth
          />
          <Input
            label={t("master.code.codeNameEn", { defaultValue: "영어명" })}
            value={form.attr3}
            onChange={(e) => handleChange("attr3", e.target.value)}
            fullWidth
          />
          <Input
            label={t("master.code.sortOrder")}
            type="number"
            value={form.sortOrder.toString()}
            onChange={(e) => handleChange("sortOrder", parseInt(e.target.value) || 1)}
            fullWidth
          />
          <UseYnSelect
            includeAll={false}
            label={t("master.code.useYn")}
            value={form.useYn}
            onChange={(val) => handleChange("useYn", val)}
            fullWidth
          />
          <div className="col-span-2">
            <Input
              label={t("master.code.codeDesc", { defaultValue: "설명" })}
              value={form.codeDesc}
              onChange={(e) => handleChange("codeDesc", e.target.value)}
              fullWidth
            />
          </div>
          <div className="col-span-2">
            <Input
              label={t("master.code.attr1", { defaultValue: "배지 색상 (Tailwind)" })}
              value={form.attr1}
              onChange={(e) => handleChange("attr1", e.target.value)}
              fullWidth
            />
            {form.attr1 && (
              <div className="mt-1.5">
                <span className={`px-2 py-0.5 text-xs rounded-full ${form.attr1}`}>
                  {form.codeName || t("master.code.preview", "미리보기")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
