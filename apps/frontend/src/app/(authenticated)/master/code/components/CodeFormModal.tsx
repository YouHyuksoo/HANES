"use client";

/**
 * @file master/code/components/CodeFormModal.tsx
 * @description 공통코드 추가/수정 모달
 *
 * 초보자 가이드:
 * 1. **editingCode**: null이면 신규 등록, 값이 있으면 수정 모드
 * 2. **onSubmit**: 폼 데이터를 부모에 전달 → API 호출
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Input, Select, Button } from "@/components/ui";
import type { ComCodeDetail, ComCodeFormData, INITIAL_FORM } from "../types";

interface CodeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ComCodeFormData) => void;
  editingCode: ComCodeDetail | null;
  selectedGroup: string;
  isSubmitting: boolean;
}

export default function CodeFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingCode,
  selectedGroup,
  isSubmitting,
}: CodeFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ComCodeFormData>({
    groupCode: selectedGroup,
    detailCode: "",
    codeName: "",
    codeDesc: "",
    sortOrder: 1,
    useYn: "Y",
    attr1: "",
    attr2: "",
    attr3: "",
  });

  useEffect(() => {
    if (editingCode) {
      setForm({
        groupCode: editingCode.groupCode,
        detailCode: editingCode.detailCode,
        codeName: editingCode.codeName,
        codeDesc: editingCode.codeDesc || "",
        sortOrder: editingCode.sortOrder,
        useYn: editingCode.useYn,
        attr1: editingCode.attr1 || "",
        attr2: editingCode.attr2 || "",
        attr3: editingCode.attr3 || "",
      });
    } else {
      setForm({
        groupCode: selectedGroup,
        detailCode: "",
        codeName: "",
        codeDesc: "",
        sortOrder: 1,
        useYn: "Y",
        attr1: "",
        attr2: "",
        attr3: "",
      });
    }
  }, [editingCode, selectedGroup, isOpen]);

  const handleChange = (field: keyof ComCodeFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.detailCode.trim() || !form.codeName.trim()) return;
    onSubmit(form);
  };

  const isEdit = !!editingCode;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t("master.code.editCode") : t("master.code.addCode")}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t("master.code.groupCode")}
          value={form.groupCode}
          onChange={(e) => handleChange("groupCode", e.target.value)}
          disabled={isEdit}
          fullWidth
        />
        <Input
          label={t("master.code.detailCode")}
          value={form.detailCode}
          onChange={(e) => handleChange("detailCode", e.target.value.toUpperCase())}
          disabled={isEdit}
          placeholder="DETAIL_CODE"
          fullWidth
        />
        <Input
          label={t("master.code.codeName")}
          value={form.codeName}
          onChange={(e) => handleChange("codeName", e.target.value)}
          placeholder={t("master.code.codeNamePlaceholder")}
          fullWidth
        />
        <Input
          label={t("master.code.codeNameEn", { defaultValue: "영어명" })}
          value={form.attr3}
          onChange={(e) => handleChange("attr3", e.target.value)}
          placeholder="English Name"
          fullWidth
        />
        <Input
          label={t("master.code.sortOrder")}
          type="number"
          value={form.sortOrder.toString()}
          onChange={(e) => handleChange("sortOrder", parseInt(e.target.value) || 1)}
          fullWidth
        />
        <Select
          label={t("master.code.useYn")}
          value={form.useYn}
          onChange={(val) => handleChange("useYn", val)}
          options={[
            { value: "Y", label: t("master.code.inUse") },
            { value: "N", label: t("master.code.notInUse") },
          ]}
          fullWidth
        />
        <div className="col-span-2">
          <Input
            label={t("master.code.codeDesc", { defaultValue: "설명" })}
            value={form.codeDesc}
            onChange={(e) => handleChange("codeDesc", e.target.value)}
            placeholder={t("master.code.codeDescPlaceholder", { defaultValue: "코드 설명 입력" })}
            fullWidth
          />
        </div>
        <div className="col-span-2">
          <Input
            label={t("master.code.attr1", { defaultValue: "배지 색상 (Tailwind)" })}
            value={form.attr1}
            onChange={(e) => handleChange("attr1", e.target.value)}
            placeholder="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            fullWidth
          />
          {form.attr1 && (
            <div className="mt-1.5">
              <span className={`px-2 py-0.5 text-xs rounded-full ${form.attr1}`}>
                {form.codeName || "미리보기"}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !form.detailCode.trim() || !form.codeName.trim()}>
          {isSubmitting
            ? t("common.saving", { defaultValue: "저장중..." })
            : isEdit
            ? t("common.edit")
            : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}
