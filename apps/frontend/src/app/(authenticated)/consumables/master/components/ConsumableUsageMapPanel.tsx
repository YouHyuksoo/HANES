"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button, ConfirmModal, Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui/Select";
import { UseYnSelect } from "@/components/shared";
import api from "@/services/api";
import type { ConsumableItem } from "./ConsumableFormPanel";

interface UsageMapRow {
  productItemCode: string;
  productItemName: string | null;
  equipCode: string;
  equipName: string | null;
  consumableCode: string;
  usagePerUnit: number;
  useYn: string;
  remark: string | null;
}

interface UsageMapFormValues {
  productItemCode: string;
  equipCode: string;
  usagePerUnit: number;
  useYn: string;
  remark: string;
}

const EMPTY_FORM: UsageMapFormValues = {
  productItemCode: "",
  equipCode: "",
  usagePerUnit: 1,
  useYn: "Y",
  remark: "",
};

interface Props {
  item: ConsumableItem | null;
  onClose?: () => void;
}

export default function ConsumableUsageMapPanel({ item, onClose }: Props) {
  const { t } = useTranslation();
  const [usageMaps, setUsageMaps] = useState<UsageMapRow[]>([]);
  const [form, setForm] = useState<UsageMapFormValues>(EMPTY_FORM);
  const [productOptions, setProductOptions] = useState<SelectOption[]>([]);
  const [equipOptions, setEquipOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UsageMapRow | null>(null);

  const set = (key: keyof UsageMapFormValues, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const reloadUsageMaps = async () => {
    if (!item) {
      setUsageMaps([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/consumables/${item.consumableCode}/usage-maps`);
      setUsageMaps(res.data?.data ?? []);
    } catch {
      /* api interceptor */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [partsRes, equipsRes] = await Promise.all([
          api.get("/master/parts", { params: { limit: 500, useYn: "Y" } }),
          api.get("/equipment/equips", { params: { limit: 500, useYn: "Y" } }),
        ]);
        const parts = (partsRes.data?.data ?? [])
          .filter((part: { itemType?: string }) => part.itemType === "FINISHED" || part.itemType === "SEMI_PRODUCT")
          .map((part: { itemCode: string; itemName?: string }) => ({
            value: part.itemCode,
            label: `${part.itemCode} - ${part.itemName ?? part.itemCode}`,
          }));
        const equips = (equipsRes.data?.data ?? []).map((equip: { equipCode: string; equipName?: string }) => ({
          value: equip.equipCode,
          label: `${equip.equipCode} - ${equip.equipName ?? equip.equipCode}`,
        }));
        setProductOptions(parts);
        setEquipOptions(equips);
      } catch {
        /* api interceptor */
      }
    };

    loadOptions();
  }, []);

  useEffect(() => {
    setForm(EMPTY_FORM);
    reloadUsageMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.consumableCode]);

  const handleSubmit = async () => {
    if (!item || !form.productItemCode || !form.equipCode) return;
    setSaving(true);
    try {
      await api.post(`/consumables/${item.consumableCode}/usage-maps`, form);
      setForm(EMPTY_FORM);
      await reloadUsageMaps();
    } catch {
      /* api interceptor */
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: UsageMapRow) => {
    if (!item) return;
    setSaving(true);
    try {
      await api.put(`/consumables/${item.consumableCode}/usage-maps/${row.productItemCode}/${row.equipCode}`, {
        useYn: row.useYn === "Y" ? "N" : "Y",
      });
      await reloadUsageMaps();
    } catch {
      /* api interceptor */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/consumables/${item.consumableCode}/usage-maps/${deleteTarget.productItemCode}/${deleteTarget.equipCode}`);
      setDeleteTarget(null);
      await reloadUsageMaps();
    } catch {
      /* api interceptor */
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="w-[420px] flex-shrink-0 border-l border-border bg-background flex flex-col h-full overflow-hidden text-xs">
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-text">
            {t("consumables.master.usageMapTitle", "소모품 사용매핑")}
          </h2>
          <p className="mt-1 text-xs text-text-muted truncate">
            {item ? `${item.consumableCode} - ${item.consumableName}` : t("consumables.master.usageMapSelectFirst", "소모품을 선택하세요.")}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={reloadUsageMaps}
            disabled={!item || loading || saving}
            className="p-1.5 rounded hover:bg-surface disabled:opacity-50"
            title={t("common.refresh")}
          >
            <RefreshCw className={`w-4 h-4 text-text-muted ${loading ? "animate-spin" : ""}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-surface"
              title={t("common.close", "닫기")}
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {!item ? (
          <div className="h-full min-h-[240px] flex items-center justify-center border border-dashed border-border rounded-lg text-center text-xs text-text-muted px-6">
            {t("consumables.master.usageMapSelectGuide", "왼쪽 목록에서 소모품을 선택하면 제품/설비 사용매핑을 상시 관리할 수 있습니다.")}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <Select
                label={t("consumables.master.usageMapProduct", "제품/모델")}
                options={productOptions}
                value={form.productItemCode}
                onChange={(value) => set("productItemCode", value)}
                placeholder={t("consumables.master.usageMapProductPlaceholder", "제품 선택")}
                fullWidth
              />
              <Select
                label={t("consumables.master.usageMapEquip", "설비")}
                options={equipOptions}
                value={form.equipCode}
                onChange={(value) => set("equipCode", value)}
                placeholder={t("consumables.master.usageMapEquipPlaceholder", "설비 선택")}
                fullWidth
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label={t("consumables.master.usagePerUnit", "단위사용량")}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.usagePerUnit.toString()}
                  onChange={(event) => set("usagePerUnit", Number(event.target.value) || 0)}
                  fullWidth
                />
                <UseYnSelect
                  includeAll={false}
                  label={t("common.useYn", "사용여부")}
                  value={form.useYn}
                  onChange={(value) => set("useYn", value)}
                  fullWidth
                />
              </div>
              <Input
                label={t("common.remark", "비고")}
                value={form.remark}
                onChange={(event) => set("remark", event.target.value)}
                placeholder={t("consumables.master.usageMapRemarkPlaceholder", "매핑 비고")}
                fullWidth
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSubmit}
                disabled={saving || !form.productItemCode || !form.equipCode}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t("consumables.master.usageMapSave", "매핑 저장")}
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_56px_46px_32px] bg-surface text-[11px] font-semibold text-text-muted">
                <div className="px-2 py-1.5 border-r border-border">{t("consumables.master.usageMapProduct", "제품/모델")}</div>
                <div className="px-2 py-1.5 border-r border-border">{t("consumables.master.usageMapEquip", "설비")}</div>
                <div className="px-2 py-1.5 border-r border-border text-right">{t("consumables.master.usagePerUnitShort", "사용량")}</div>
                <div className="px-2 py-1.5 border-r border-border text-center">{t("common.useYn", "사용")}</div>
                <div className="px-1 py-1.5" />
              </div>

              {loading ? (
                <div className="h-24 flex items-center justify-center text-text-muted">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              ) : usageMaps.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-text-muted">
                  {t("consumables.master.usageMapEmpty", "등록된 사용매핑이 없습니다.")}
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
                  {usageMaps.map((row) => (
                    <div
                      key={`${row.productItemCode}-${row.equipCode}`}
                      className={`grid grid-cols-[1fr_1fr_56px_46px_32px] text-[11px] ${row.useYn === "Y" ? "text-text" : "text-text-muted opacity-70"}`}
                    >
                      <div className="px-2 py-2 border-r border-border min-w-0">
                        <div className="font-mono truncate">{row.productItemCode}</div>
                        <div className="truncate text-text-muted">{row.productItemName ?? "-"}</div>
                      </div>
                      <div className="px-2 py-2 border-r border-border min-w-0">
                        <div className="font-mono truncate">{row.equipCode}</div>
                        <div className="truncate text-text-muted">{row.equipName ?? "-"}</div>
                      </div>
                      <div className="px-2 py-2 border-r border-border text-right font-mono">
                        {Number(row.usagePerUnit ?? 0).toLocaleString()}
                      </div>
                      <div className="px-1 py-2 border-r border-border text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(row)}
                          disabled={saving}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            row.useYn === "Y"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-surface text-text-muted"
                          }`}
                        >
                          {row.useYn}
                        </button>
                      </div>
                      <div className="px-1 py-1.5 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          disabled={saving}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                          title={t("common.delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("common.delete")}
        message={`${deleteTarget?.productItemCode ?? ""} / ${deleteTarget?.equipCode ?? ""} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        confirmText={t("common.delete")}
        variant="danger"
        isLoading={saving}
      />
    </aside>
  );
}
