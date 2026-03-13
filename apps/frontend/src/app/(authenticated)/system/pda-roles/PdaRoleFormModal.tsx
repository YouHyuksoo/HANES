"use client";

/**
 * @file system/pda-roles/PdaRoleFormModal.tsx
 * @description PDA 역할 생성/수정 모달 — 역할 정보 + PDA 메뉴 체크박스
 *
 * 초보자 가이드:
 * 1. 생성 모드: code 입력 가능 (PK이므로 수정 시 비활성)
 * 2. 메뉴코드 목록: /system/pda-roles/menu-codes API에서 조회
 * 3. 체크박스로 허용 메뉴 선택 → menuCodes 배열로 전송
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Input, Button } from "@/components/ui";
import { api } from "@/services/api";
import type { PdaRole } from "./page";

interface MenuCodeOption {
  code: string;
  label: string;
}

interface PdaRoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingRole: PdaRole | null;
}

export default function PdaRoleFormModal({
  isOpen,
  onClose,
  onSaved,
  editingRole,
}: PdaRoleFormModalProps) {
  const { t } = useTranslation();
  const isEdit = !!editingRole;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedMenus, setSelectedMenus] = useState<Set<string>>(new Set());
  const [menuOptions, setMenuOptions] = useState<MenuCodeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** 메뉴코드 목록 로드 */
  useEffect(() => {
    if (!isOpen) return;
    api
      .get("/system/pda-roles/menu-codes")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setMenuOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => setMenuOptions([]));
  }, [isOpen]);

  /** 편집 모드 초기값 */
  useEffect(() => {
    if (!isOpen) return;
    if (editingRole) {
      setCode(editingRole.code);
      setName(editingRole.name);
      setDescription(editingRole.description ?? "");
      setIsActive(editingRole.isActive);
      setSelectedMenus(
        new Set(editingRole.menus?.map((m) => m.menuCode) ?? [])
      );
    } else {
      setCode("");
      setName("");
      setDescription("");
      setIsActive(true);
      setSelectedMenus(new Set());
    }
    setError("");
  }, [isOpen, editingRole]);

  const toggleMenu = useCallback((menuCode: string) => {
    setSelectedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuCode)) next.delete(menuCode);
      else next.add(menuCode);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedMenus((prev) => {
      if (prev.size === menuOptions.length) return new Set();
      return new Set(menuOptions.map((m) => m.code));
    });
  }, [menuOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload = {
        ...(!isEdit && { code }),
        name,
        description: description || undefined,
        isActive,
        menuCodes: Array.from(selectedMenus),
      };

      if (isEdit) {
        await api.patch(`/system/pda-roles/${editingRole!.code}`, payload);
      } else {
        await api.post("/system/pda-roles", payload);
      }
      onSaved();
    } catch (err: any) {
      setError(
        err.response?.data?.message || t("common.error")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? t("system.pdaRoles.editTitle")
          : t("system.pdaRoles.addTitle")
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 역할 코드 */}
        <Input
          label={t("system.pdaRoles.code")}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="PDA_CUSTOM_ROLE"
          disabled={isEdit}
          required
          fullWidth
        />

        {/* 역할 이름 */}
        <Input
          label={t("system.pdaRoles.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("system.pdaRoles.namePlaceholder")}
          required
          fullWidth
        />

        {/* 역할 설명 */}
        <Input
          label={t("system.pdaRoles.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("system.pdaRoles.descPlaceholder")}
          fullWidth
        />

        {/* 활성 여부 (수정 시만) */}
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            {t("common.active")}
          </label>
        )}

        {/* PDA 메뉴 권한 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("system.pdaRoles.menuPermissions")}
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-primary hover:underline"
            >
              {selectedMenus.size === menuOptions.length
                ? t("common.deselectAll")
                : t("common.selectAll")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            {menuOptions.map((opt) => (
              <label
                key={opt.code}
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:text-primary"
              >
                <input
                  type="checkbox"
                  checked={selectedMenus.has(opt.code)}
                  onChange={() => toggleMenu(opt.code)}
                  className="rounded border-slate-300 dark:border-slate-600 text-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" isLoading={saving}>
            {isEdit ? t("common.save") : t("common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
