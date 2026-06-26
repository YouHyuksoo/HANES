"use client";

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Barcode, Circle, Copy, Image as ImageIcon, Loader2, Minus, Square, TableProperties, Trash2, Type, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/services/api";
import { resolveBackendFileUrl } from "@/utils/file-url";
import {
  BARCODE_FORMATS,
  BarcodeFormat,
  LabelCategory,
  LabelDesign,
  LabelElement,
  LabelElementKind,
  LabelSourceTable,
} from "../types";
import { getDesignSourceFields, getLabelSource, getSampleData, labelSources } from "../labelSources";
import LabelDesignRenderer, { ResizeAnchor } from "./LabelDesignRenderer";

const SCALE = 5;

interface LabelObjectDesignerProps {
  category: LabelCategory;
  design: LabelDesign;
  onChange: (design: LabelDesign) => void;
}

type Interaction =
  | {
      mode: "move";
      elementId: string;
      startX: number;
      startY: number;
      origin: LabelElement;
    }
  | {
      mode: "resize";
      elementId: string;
      anchor: ResizeAnchor;
      startX: number;
      startY: number;
      origin: LabelElement;
    };

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export default function LabelObjectDesigner({ category, design, onChange }: LabelObjectDesignerProps) {
  const { t } = useTranslation();
  const elementLabels: Record<LabelElementKind, string> = {
    text: t("master.label.elemText", "글자"),
    barcode: t("master.label.elemBarcode", "바코드"),
    box: t("master.label.elemBox", "박스"),
    line: t("master.label.elemLine", "선"),
    circle: t("master.label.elemCircle", "원"),
    image: t("master.label.elemImage", "이미지"),
  };
  const sourceTableLabels: Record<LabelSourceTable, string> = {
    equipment: t("master.label.srcEquipment", "설비"),
    consumable: t("master.label.srcConsumable", "소모품"),
    worker: t("master.label.srcWorker", "작업자"),
    mat_lot: t("master.label.srcMatLot", "자재 LOT"),
    box: t("master.label.srcBox", "제품포장"),
    pallet: t("master.label.srcPallet", "팔레트"),
    sg_label: t("master.label.srcSgLabel", "반제품 SG"),
    fg_label: t("master.label.srcFgLabel", "완제품 FG"),
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(design.elements?.[0]?.id ?? null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const source = getLabelSource(category, design.sourceTable);
  const sourceFields = useMemo(() => getDesignSourceFields(design, category), [category, design]);
  const sampleData = useMemo(
    () => getSampleData(category, design.sourceTable, sourceFields),
    [category, design.sourceTable, sourceFields],
  );
  const selected = useMemo(
    () => design.elements?.find((element) => element.id === selectedId) ?? null,
    [design.elements, selectedId],
  );

  const fieldLabel = useCallback(
    (table: LabelSourceTable, key: string, fallback: string) =>
      t(`master.label.field.${table}.${key}`, fallback),
    [t],
  );

  const updateDesign = useCallback((patch: Partial<LabelDesign>) => {
    onChange({ ...design, ...patch });
  }, [design, onChange]);

  const updateElement = useCallback((id: string, patch: Partial<LabelElement>) => {
    onChange({
      ...design,
      elements: (design.elements ?? []).map((element) =>
        element.id === id ? { ...element, ...patch } : element),
    });
  }, [design, onChange]);

  const addElement = useCallback((type: LabelElementKind, barcodeFormat?: BarcodeFormat, fieldKey?: string) => {
    const field = fieldKey ?? sourceFields[0]?.key;
    const sourceField = fieldKey ?? (type === "barcode" ? field : undefined);
    const base: LabelElement = {
      id: uid(type),
      type,
      x: 6,
      y: 6,
      width: type === "line" ? 30 : type === "barcode" ? 18 : 24,
      height: type === "line" ? 1 : type === "text" ? 6 : type === "barcode" ? 18 : 14,
      sourceTable: source.table,
      sourceField,
      text: type === "text" ? "TEXT" : undefined,
      barcodeFormat: type === "barcode" ? (barcodeFormat ?? "qrcode") : undefined,
      fontSize: type === "text" ? 3 : undefined,
      fontFamily: type === "text" ? "sans-serif" : undefined,
      fontWeight: type === "text" ? "bold" : undefined,
      align: type === "text" ? "left" : undefined,
      strokeColor: "#111827",
      fillColor: type === "box" || type === "circle" ? "transparent" : undefined,
      textColor: "#111827",
      lineWidth: type === "line" || type === "box" || type === "circle" ? 0.35 : undefined,
      zIndex: (design.elements?.length ?? 0) + 10,
    };
    onChange({ ...design, elements: [...(design.elements ?? []), base] });
    setSelectedId(base.id);
  }, [design, onChange, source.table, sourceFields]);

  const uploadImageFile = useCallback(async (file: File) => {
    if (!selected || selected.type !== "image") return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/master/label-templates/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.data?.url;
      if (url) updateElement(selected.id, { imageUrl: url, sourceField: undefined });
    } finally {
      setImageUploading(false);
    }
  }, [selected, updateElement]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadImageFile(file);
    event.target.value = "";
  };

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const next = (design.elements ?? []).filter((element) => element.id !== selectedId);
    onChange({ ...design, elements: next });
    setSelectedId(next[0]?.id ?? null);
  }, [design, onChange, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const copy = {
      ...selected,
      id: uid(selected.type),
      x: selected.x + 3,
      y: selected.y + 3,
      zIndex: (design.elements?.length ?? 0) + 20,
    };
    onChange({ ...design, elements: [...(design.elements ?? []), copy] });
    setSelectedId(copy.id);
  }, [design, onChange, selected]);

  const handleElementPointerDown = useCallback((id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const element = design.elements?.find((item) => item.id === id);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    setInteraction({
      mode: "move",
      elementId: id,
      startX: event.clientX,
      startY: event.clientY,
      origin: element,
    });
  }, [design.elements]);

  const handleResizePointerDown = useCallback((id: string, anchor: ResizeAnchor, event: ReactPointerEvent<HTMLSpanElement>) => {
    const element = design.elements?.find((item) => item.id === id);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    setInteraction({
      mode: "resize",
      elementId: id,
      anchor,
      startX: event.clientX,
      startY: event.clientY,
      origin: element,
    });
  }, [design.elements]);

  useEffect(() => {
    if (!interaction) return;

    const handleMove = (event: PointerEvent) => {
      const dx = (event.clientX - interaction.startX) / SCALE;
      const dy = (event.clientY - interaction.startY) / SCALE;
      const origin = interaction.origin;

      if (interaction.mode === "move") {
        updateElement(interaction.elementId, {
          x: round(clamp(origin.x + dx, 0, design.labelWidth - origin.width)),
          y: round(clamp(origin.y + dy, 0, design.labelHeight - origin.height)),
        });
        return;
      }

      let x = origin.x;
      let y = origin.y;
      let width = origin.width;
      let height = origin.height;

      if (interaction.anchor.includes("e")) width = origin.width + dx;
      if (interaction.anchor.includes("s")) height = origin.height + dy;
      if (interaction.anchor.includes("w")) {
        x = origin.x + dx;
        width = origin.width - dx;
      }
      if (interaction.anchor.includes("n")) {
        y = origin.y + dy;
        height = origin.height - dy;
      }

      width = clamp(width, 2, design.labelWidth - x);
      height = clamp(height, 1, design.labelHeight - y);
      x = clamp(x, 0, design.labelWidth - width);
      y = clamp(y, 0, design.labelHeight - height);

      updateElement(interaction.elementId, {
        x: round(x),
        y: round(y),
        width: round(width),
        height: round(height),
      });
    };

    const handleUp = () => setInteraction(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [design.labelHeight, design.labelWidth, interaction, updateElement]);

  const changeSourceTable = (next: LabelSourceTable) => {
    const nextFields = labelSources[next].fields;
    updateDesign({
      sourceTable: next,
      sourceFields: nextFields,
      elements: (design.elements ?? []).map((element) => ({
        ...element,
        sourceTable: next,
        sourceField: element.sourceField && nextFields.some((field) => field.key === element.sourceField)
          ? element.sourceField
          : undefined,
      })),
    });
  };

  return (
    <div className="h-full min-h-0 grid grid-cols-[220px_minmax(420px,1fr)_280px] gap-4">
      <section className="min-h-0 rounded border border-border bg-surface p-3 overflow-y-auto">
        <div className="flex items-center gap-2 text-sm font-semibold text-text mb-3">
          <TableProperties className="w-4 h-4 text-primary" />
          {t("master.label.sourceAndObjects", "소스와 객체")}
        </div>

        <label className="block text-xs font-medium text-text-muted mb-1">{t("master.label.sourceTable", "소스테이블")}</label>
        <select
          value={source.table}
          onChange={(event) => changeSourceTable(event.target.value as LabelSourceTable)}
          className="w-full h-9 rounded border border-border bg-background px-2 text-sm text-text mb-4"
        >
          {Object.values(labelSources).map((item) => (
            <option key={item.table} value={item.table}>{sourceTableLabels[item.table]}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <ToolButton icon={Type} label={t("master.label.elemText", "글자")} onClick={() => addElement("text")} />
          <ToolButton icon={Barcode} label={t("master.label.elem1d", "1D")} onClick={() => addElement("barcode", "code128")} />
          <ToolButton icon={Barcode} label={t("master.label.elem2d", "2D")} onClick={() => addElement("barcode", "qrcode")} />
          <ToolButton icon={Square} label={t("master.label.elemBox", "박스")} onClick={() => addElement("box")} />
          <ToolButton icon={Minus} label={t("master.label.elemLine", "선")} onClick={() => addElement("line")} />
          <ToolButton icon={Circle} label={t("master.label.elemCircle", "원")} onClick={() => addElement("circle")} />
          <ToolButton icon={ImageIcon} label={t("master.label.elemImage", "이미지")} onClick={() => addElement("image")} />
        </div>

        <div className="mt-5 space-y-1.5">
          <div className="text-xs font-semibold text-text-muted">{t("master.label.fieldsHint", "필드 (클릭하면 글자 추가)")}</div>
          {sourceFields.map((field) => (
            <button
              key={field.key}
              type="button"
              onClick={() => addElement("text", undefined, field.key)}
              title={t("master.label.addFieldTextObject", "'{{label}}' 글자 객체 추가", { label: fieldLabel(source.table, field.key, field.label) })}
              className="block w-full text-left rounded border border-border bg-background px-2 py-1.5 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">{fieldLabel(source.table, field.key, field.label)}</span>
                <span className="shrink-0 font-mono text-[10px] text-text-muted">{field.key}</span>
              </div>
              <div className="truncate text-[10px] text-text-muted">{field.sample || "—"}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0 min-h-0 rounded border border-border bg-slate-100 dark:bg-slate-950 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-text">{t("master.label.designCanvas", "디자인 캔버스")}</div>
            <div className="text-xs text-text-muted">{t("master.label.designCanvasHint", "객체를 끌어서 이동하고 모서리 앵커로 크기를 조절합니다.")}</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <NumberInput label="W" value={design.labelWidth} onChange={(value) => updateDesign({ labelWidth: value })} />
            <NumberInput label="H" value={design.labelHeight} onChange={(value) => updateDesign({ labelHeight: value })} />
            <span>mm</span>
          </div>
        </div>

        <div ref={canvasRef} className="inline-block rounded bg-white p-5 shadow-sm">
          <LabelDesignRenderer
            design={design}
            data={sampleData}
            scale={SCALE}
            selectedId={selectedId}
            editable
            onSelect={setSelectedId}
            onElementPointerDown={handleElementPointerDown}
            onResizePointerDown={handleResizePointerDown}
          />
        </div>
      </section>

      <section className="min-h-0 rounded border border-border bg-surface p-3 overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-sm font-semibold text-text">{t("master.label.objectProps", "객체 속성")}</div>
            <div className="text-xs text-text-muted">{selected ? elementLabels[selected.type] : t("master.label.noSelection", "선택 없음")}</div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={duplicateSelected} disabled={!selected}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="danger" onClick={deleteSelected} disabled={!selected}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {selected ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="X" value={selected.x} onChange={(value) => updateElement(selected.id, { x: value })} />
              <NumberInput label="Y" value={selected.y} onChange={(value) => updateElement(selected.id, { y: value })} />
              <NumberInput label="W" value={selected.width} onChange={(value) => updateElement(selected.id, { width: value })} />
              <NumberInput label="H" value={selected.height} onChange={(value) => updateElement(selected.id, { height: value })} />
            </div>

            {(selected.type === "text" || selected.type === "barcode" || selected.type === "image") && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">{t("master.label.sourceField", "소스 필드")}</label>
                <select
                  value={selected.sourceField ?? ""}
                  onChange={(event) => updateElement(selected.id, { sourceField: event.target.value || undefined })}
                  className="w-full h-9 rounded border border-border bg-background px-2 text-sm text-text"
                >
                  {(selected.type === "text" || selected.type === "image") && (
                    <option value="">{t("master.label.noSourceField", "고정값 사용")}</option>
                  )}
                  {sourceFields.map((field) => (
                    <option key={field.key} value={field.key}>{fieldLabel(source.table, field.key, field.label)} ({field.key})</option>
                  ))}
                </select>
              </div>
            )}

            {selected.type === "text" && (
              <>
                <TextareaInput label={t("master.label.fixedText", "고정 문구")} value={selected.text ?? ""} onChange={(value) => updateElement(selected.id, { text: value })} />
                <NumberInput label={t("master.label.fontSizeMm", "글자 크기(mm)")} value={selected.fontSize ?? 3} onChange={(value) => updateElement(selected.id, { fontSize: value })} />
                <div className="grid grid-cols-2 gap-2">
                  <SelectInput label={t("master.label.fontWeight", "굵기")} value={selected.fontWeight ?? "normal"} options={["normal", "bold"]} onChange={(value) => updateElement(selected.id, { fontWeight: value as "normal" | "bold" })} />
                  <SelectInput label={t("master.label.align", "정렬")} value={selected.align ?? "left"} options={["left", "center", "right"]} onChange={(value) => updateElement(selected.id, { align: value as "left" | "center" | "right" })} />
                </div>
              </>
            )}

            {selected.type === "barcode" && (
              <SelectInput
                label={t("master.label.barcodeType", "바코드 유형")}
                value={selected.barcodeFormat ?? "qrcode"}
                options={BARCODE_FORMATS.map((format) => format.value)}
                onChange={(value) => updateElement(selected.id, { barcodeFormat: value as BarcodeFormat })}
              />
            )}

            {selected.type === "image" && (
              <div className="space-y-2">
                {selected.imageUrl && (
                  <div className="h-24 overflow-hidden rounded border border-border bg-background">
                    <img
                      src={resolveBackendFileUrl(selected.imageUrl)}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    {imageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {imageUploading ? t("common.uploading", "업로드 중...") : t("master.label.uploadImage", "이미지 업로드")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => updateElement(selected.id, { imageUrl: "", sourceField: undefined })}
                    disabled={!selected.imageUrl || imageUploading}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <TextInput label={t("master.label.defaultImageUrl", "또는 이미지 URL")} value={selected.imageUrl ?? ""} onChange={(value) => updateElement(selected.id, { imageUrl: value, sourceField: undefined })} />
              </div>
            )}

            {(selected.type === "box" || selected.type === "circle" || selected.type === "line") && (
              <NumberInput label={t("master.label.lineWidthMm", "선 두께(mm)")} value={selected.lineWidth ?? 0.35} onChange={(value) => updateElement(selected.id, { lineWidth: value })} />
            )}

            <div className="grid grid-cols-2 gap-2">
              <ColorInput label={t("master.label.lineTextColor", "선/글자")} value={selected.type === "text" ? (selected.textColor ?? "#111827") : (selected.strokeColor ?? "#111827")}
                onChange={(value) => updateElement(selected.id, selected.type === "text" ? { textColor: value } : { strokeColor: value })} />
              {(selected.type === "box" || selected.type === "circle") && (
                <ColorInput label={t("master.label.fillColor", "채움")} value={selected.fillColor === "transparent" ? "#ffffff" : selected.fillColor ?? "#ffffff"}
                  onChange={(value) => updateElement(selected.id, { fillColor: value })} />
              )}
            </div>
          </div>
        ) : (
          <div className="h-32 rounded border border-dashed border-border flex items-center justify-center text-sm text-text-muted">
            {t("master.label.selectCanvasObject", "캔버스의 객체를 선택하세요.")}
          </div>
        )}
      </section>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: typeof Type; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-16 rounded border border-border bg-background hover:border-primary hover:text-primary transition-colors flex flex-col items-center justify-center gap-1 text-xs text-text"
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-text-muted mb-1">{label}</span>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="w-full h-8 rounded border border-border bg-background px-2 text-sm text-text"
      />
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-text-muted mb-1">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-8 rounded border border-border bg-background px-2 text-sm text-text"
      />
    </label>
  );
}

function TextareaInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-text-muted mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-text resize-y"
      />
    </label>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-text-muted mb-1">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}
        className="w-full h-8 rounded border border-border bg-background px-2 text-sm text-text">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-text-muted mb-1">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-8 rounded border border-border bg-background p-1"
      />
    </label>
  );
}
