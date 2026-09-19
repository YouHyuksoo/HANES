"use client";
import { useTranslation } from "react-i18next";
import { Input, Button } from "@/components/ui";
import { UseYnSelect } from "@/components/shared";

export interface InspectItemSpecForm {
  itemCode: string;
  inspectType: string;
  connectorKey: string;
  chargeBar: string;
  chargeTolBar: string;
  holdSeconds: string;
  minHoldBar: string;
  testVoltageKv: string;
  testSeconds: string;
  maxCurrentMa: string;
  /** 절연저항 하한 MΩ — HIPOT 검사기에서 절연저항을 같이 판정한다 */
  minInsulationMohm: string;
  torqueLsl: string;
  torqueUsl: string;
  torqueUnit: string;
  remark: string;
  useYn: string;
}

export function emptyInspectItemSpecForm(): InspectItemSpecForm {
  return {
    itemCode: "", inspectType: "LEAK", connectorKey: "*",
    chargeBar: "0.7", chargeTolBar: "0.2", holdSeconds: "2", minHoldBar: "0.3",
    testVoltageKv: "3", testSeconds: "2", maxCurrentMa: "2", minInsulationMohm: "",
    torqueLsl: "", torqueUsl: "", torqueUnit: "kgf.m",
    remark: "", useYn: "Y",
  };
}

export function validateInspectItemSpecForm(form: InspectItemSpecForm): string | null {
  if (!form.itemCode.trim()) return "itemCode";
  if (!["LEAK", "HIPOT", "TORQUE"].includes(form.inspectType)) return "inspectType";
  return null;
}

interface Props {
  form: InspectItemSpecForm;
  onChange: (key: keyof InspectItemSpecForm, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
}

export default function InspectItemSpecFormPanel({ form, onChange, onSave, onCancel, saving, isEdit }: Props) {
  const { t } = useTranslation();
  const num = (key: keyof InspectItemSpecForm, label: string) => (
    <Input label={label} type="number" step="0.001" value={form[key]}
      onChange={(e) => onChange(key, e.target.value)} fullWidth />
  );
  return (
    <div className="flex flex-col gap-3 min-h-0 overflow-y-auto p-3 text-sm">
      <Input label={t("master.inspectItemSpec.itemCode")} value={form.itemCode}
        onChange={(e) => onChange("itemCode", e.target.value)} required fullWidth />
      <div>
        <label className="block text-xs text-text-muted mb-1">{t("master.inspectItemSpec.inspectType")}</label>
        <select className="w-full border rounded px-2 py-1.5 bg-background"
          value={form.inspectType} onChange={(e) => onChange("inspectType", e.target.value)}>
          <option value="LEAK">LEAK</option>
          <option value="HIPOT">HIPOT</option>
          <option value="TORQUE">TORQUE</option>
        </select>
      </div>
      <Input label={t("master.inspectItemSpec.connectorKey")} value={form.connectorKey}
        onChange={(e) => onChange("connectorKey", e.target.value)} fullWidth />
      {form.inspectType === "LEAK" && (
        <div className="grid grid-cols-2 gap-2">
          {num("chargeBar", t("master.inspectItemSpec.chargeBar"))}
          {num("chargeTolBar", t("master.inspectItemSpec.chargeTolBar"))}
          {num("holdSeconds", t("master.inspectItemSpec.holdSeconds"))}
          {num("minHoldBar", t("master.inspectItemSpec.minHoldBar"))}
        </div>
      )}
      {form.inspectType === "HIPOT" && (
        <div className="grid grid-cols-2 gap-2">
          {num("testVoltageKv", t("master.inspectItemSpec.testVoltageKv"))}
          {num("testSeconds", t("master.inspectItemSpec.testSeconds"))}
          {num("maxCurrentMa", t("master.inspectItemSpec.maxCurrentMa"))}
          {num("minInsulationMohm", t("master.inspectItemSpec.minInsulationMohm"))}
        </div>
      )}
      {form.inspectType === "TORQUE" && (
        <div className="grid grid-cols-2 gap-2">
          {num("torqueLsl", t("master.inspectItemSpec.torqueLsl"))}
          {num("torqueUsl", t("master.inspectItemSpec.torqueUsl"))}
          <Input label={t("master.inspectItemSpec.torqueUnit")} value={form.torqueUnit}
            onChange={(e) => onChange("torqueUnit", e.target.value)} fullWidth />
        </div>
      )}
      <Input label={t("common.remark")} value={form.remark}
        onChange={(e) => onChange("remark", e.target.value)} fullWidth />
      <UseYnSelect includeAll={false} label={t("common.useYn")} value={form.useYn}
        onChange={(v) => onChange("useYn", v)} fullWidth />
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving}>{t("common.save")}</Button>
        <Button variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
        {isEdit ? null : null}
      </div>
    </div>
  );
}
