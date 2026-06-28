"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui";
import api from "@/services/api";
import type { EditableRoutingMaterial, RoutingMaterial, SelectedProcess } from "../types";

function toEditable(material: RoutingMaterial): EditableRoutingMaterial {
  return {
    childItemCode: material.childItemCode,
    childItemName: material.childItemName || "",
    childItemNo: material.childItemNo || "",
    unit: material.unit || "",
    qtyPer: Number(material.qtyPer || 0),
    selected: material.selected,
    circuitId: material.circuitId != null ? String(material.circuitId) : "",
    circuitNo: material.circuitNo || "",
    lengthMm: material.lengthMm ?? null,
    stripA: material.stripA ?? null,
    stripB: material.stripB ?? null,
    circuitOptions: material.circuitOptions ?? [],
    allocQty: material.allocQty != null ? String(material.allocQty) : String(material.qtyPer || 0),
    issueMethod: material.issueMethod || "BACKFLUSH",
  };
}

export default function RoutingMaterialEditor({ selectedProcess }: { selectedProcess: SelectedProcess }) {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<EditableRoutingMaterial[]>([]);
  const [original, setOriginal] = useState<EditableRoutingMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(materials) !== JSON.stringify(original), [materials, original]);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/materials`);
      const data = (res.data?.data ?? []).map(toEditable);
      setMaterials(data);
      setOriginal(data);
    } catch {
      setMaterials([]);
      setOriginal([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProcess.routingCode, selectedProcess.seq]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const change = useCallback((childItemCode: string, patch: Partial<EditableRoutingMaterial>) => {
    setMaterials((prev) => prev.map((material) =>
      material.childItemCode === childItemCode ? { ...material, ...patch } : material,
    ));
  }, []);

  const changeCircuit = useCallback((material: EditableRoutingMaterial, circuitId: string) => {
    const circuit = material.circuitOptions.find((option) => String(option.circuitId) === circuitId);
    change(material.childItemCode, {
      circuitId,
      circuitNo: circuit?.circuitNo ?? "",
      lengthMm: circuit?.lengthMm ?? null,
      stripA: circuit?.stripA ?? null,
      stripB: circuit?.stripB ?? null,
    });
  }, [change]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.put(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/materials/bulk`, {
        materials: materials
          .filter((material) => material.selected)
          .map((material) => ({
            childItemCode: material.childItemCode,
            circuitId: material.circuitId ? Number(material.circuitId) : undefined,
            allocQty: material.allocQty ? Number(material.allocQty) : 0,
            issueMethod: material.issueMethod || "BACKFLUSH",
          })),
      });
      await fetchMaterials();
    } finally {
      setSaving(false);
    }
  }, [fetchMaterials, materials, selectedProcess.routingCode, selectedProcess.seq]);

  const inputCls = "w-full px-2 py-1 text-xs border border-border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between mb-4 shrink-0 gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text dark:text-gray-100">
            {t("master.routing.materialEditorTitle", { defaultValue: "투입자재" })}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted dark:text-gray-400 min-w-0">
            <span className="font-medium text-primary truncate">{selectedProcess.routingCode}</span>
            <span>&gt;</span>
            <span className="font-medium text-text dark:text-gray-200 truncate">{selectedProcess.processName}</span>
            <span>{selectedProcess.processCode}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{t("master.routing.unsavedChanges")}</span>}
          <Button size="sm" onClick={save} disabled={saving || !isDirty}>
            {saving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted dark:text-gray-400 text-sm">
            {t("master.routing.noBomMaterial", { defaultValue: "이 라우팅 품목에 등록된 BOM 자재가 없습니다." })}
          </div>
        ) : (
          <table className="min-w-[760px] w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface dark:bg-gray-800">
              <tr className="border-b border-border dark:border-gray-600">
                <th className="py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-14 whitespace-nowrap">{t("common.select")}</th>
                <th className="text-left py-2 px-2 font-medium text-text-muted dark:text-gray-400 min-w-[170px] whitespace-nowrap">{t("master.bom.childItem", { defaultValue: "자재" })}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[80px] whitespace-nowrap">{t("master.bom.qtyPer", { defaultValue: "BOM수량" })}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 min-w-[150px] whitespace-nowrap">{t("master.routing.circuitSpec", { defaultValue: "회로사양" })}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[120px] whitespace-nowrap">{t("master.routing.cutStripSpec", { defaultValue: "길이/Strip" })}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[90px] whitespace-nowrap">{t("master.routing.allocQty", { defaultValue: "투입수량" })}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[110px] whitespace-nowrap">{t("master.routing.issueMethod", { defaultValue: "투입방식" })}</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.childItemCode} className="border-b border-border/50 dark:border-gray-700 hover:bg-surface-hover dark:hover:bg-gray-700/50">
                  <td className="py-1.5 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={material.selected}
                      onChange={(e) => change(material.childItemCode, { selected: e.target.checked })}
                      className="w-4 h-4 rounded text-primary cursor-pointer"
                    />
                  </td>
                  <td className="py-1.5 px-2 min-w-0">
                    <div className="font-medium text-text dark:text-gray-100 truncate">{material.childItemName || material.childItemCode}</div>
                    <div className="text-[11px] text-text-muted dark:text-gray-400 truncate">
                      {material.childItemCode}{material.childItemNo ? ` / ${material.childItemNo}` : ""}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-center text-text dark:text-gray-200">{material.qtyPer}</td>
                  <td className="py-1.5 px-2">
                    <select
                      value={material.circuitId}
                      disabled={!material.selected}
                      onChange={(e) => changeCircuit(material, e.target.value)}
                      className={`${inputCls} disabled:opacity-50`}
                    >
                      <option value="">{t("master.routing.noCircuitLink", { defaultValue: "미연결" })}</option>
                      {material.circuitOptions.map((circuit) => (
                        <option key={circuit.circuitId} value={circuit.circuitId}>
                          {circuit.circuitNo}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 px-2 text-center text-[11px] text-text-muted dark:text-gray-400">
                    {material.circuitId
                      ? `${material.lengthMm ?? "-"} / ${material.stripA ?? "-"} / ${material.stripB ?? "-"}`
                      : "-"}
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={material.allocQty}
                      disabled={!material.selected}
                      onChange={(e) => change(material.childItemCode, { allocQty: e.target.value })}
                      className={`${inputCls} text-center disabled:opacity-50`}
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={material.issueMethod}
                      disabled={!material.selected}
                      onChange={(e) => change(material.childItemCode, { issueMethod: e.target.value })}
                      className={`${inputCls} disabled:opacity-50`}
                    >
                      <option value="BACKFLUSH">{t("master.routing.backflush", { defaultValue: "백플러시" })}</option>
                      <option value="PRE_ISSUE">{t("master.routing.preIssue", { defaultValue: "선투입" })}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
