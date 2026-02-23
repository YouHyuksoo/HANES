"use client";

/**
 * @file RoleFormModal.tsx
 * @description 역할 추가/수정 모달 컴포넌트
 *
 * 초보자 가이드:
 * 1. **추가 모드**: role이 null이면 새 역할 생성 (code 입력 가능)
 * 2. **수정 모드**: role이 있으면 기존 역할 수정 (code 수정 불가)
 * 3. **code 자동 변환**: 영문 대문자 + 언더스코어만 허용, 자동 변환
 * 4. **API**: POST /api/roles (추가), PATCH /api/roles/:id (수정)
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Input, Button } from "@/components/ui";
import { api } from "@/services/api";

/** 역할 데이터 인터페이스 */
export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

interface RoleFormModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 수정할 역할 (null이면 추가 모드) */
  role: Role | null;
  /** 저장 성공 콜백 */
  onSaved: () => void;
}

export default function RoleFormModal({
  isOpen,
  onClose,
  role,
  onSaved,
}: RoleFormModalProps) {
  const { t } = useTranslation();
  const isEdit = !!role;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      if (role) {
        setCode(role.code);
        setName(role.name);
        setDescription(role.description || "");
        setSortOrder(role.sortOrder);
      } else {
        setCode("");
        setName("");
        setDescription("");
        setSortOrder(0);
      }
      setError("");
    }
  }, [isOpen, role]);

  /** code 입력 처리: 영문 대문자 + 언더스코어만 허용 */
  const handleCodeChange = (value: string) => {
    const formatted = value.toUpperCase().replace(/[^A-Z_]/g, "");
    setCode(formatted);
  };

  /** 저장 처리 */
  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) {
      setError(t("common.error"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (isEdit && role) {
        await api.patch(`/roles/${role.id}`, {
          name: name.trim(),
          description: description.trim() || null,
          sortOrder,
        });
      } else {
        await api.post("/roles", {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || null,
          sortOrder,
        });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t("system.roles.editRole") : t("system.roles.addRole")}
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          label={t("system.roles.code")}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={isEdit}
          placeholder="ROLE_CODE"
          fullWidth
          required
        />
        {!isEdit && (
          <p className="text-xs text-text-muted -mt-2">
            {t("system.roles.codeFormatHint")}
          </p>
        )}

        <Input
          label={t("system.roles.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
        />

        <Input
          label={t("system.roles.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
        />

        <Input
          label={t("system.roles.sortOrder")}
          type="number"
          value={String(sortOrder)}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          fullWidth
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : isEdit ? t("common.edit") : t("common.add")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
