"use client";

import { forwardRef, PointerEvent, useEffect, useMemo, useState } from "react";
import { LabelDesign, LabelElement, BarcodeFormat } from "../types";
import { resolveLabelValue } from "../labelSources";
import { resolveBackendFileUrl } from "@/utils/file-url";

type RenderUnit = "px" | "mm";

interface LabelDesignRendererProps {
  design: LabelDesign;
  data?: Record<string, unknown>;
  unit?: RenderUnit;
  scale?: number;
  selectedId?: string | null;
  editable?: boolean;
  onSelect?: (id: string) => void;
  onElementPointerDown?: (id: string, event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown?: (id: string, anchor: ResizeAnchor, event: PointerEvent<HTMLSpanElement>) => void;
}

export type ResizeAnchor = "nw" | "ne" | "sw" | "se";

const barcodeMap: Record<BarcodeFormat, string> = {
  qrcode: "qrcode",
  datamatrix: "datamatrix",
  code39: "code39",
  code128: "code128",
};

const fitImageStyle = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "contain",
} as const;

const placeholderStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f1f5f9",
  color: "#94a3b8",
  fontSize: "10px",
} as const;

function cssSize(value: number, unit: RenderUnit, scale: number) {
  return unit === "mm" ? `${value}mm` : `${value * scale}px`;
}

function cssFont(value: number | undefined, unit: RenderUnit, scale: number) {
  const fontSize = value ?? 3;
  return unit === "mm" ? `${fontSize}mm` : `${fontSize * scale}px`;
}

function BarcodeImage({ value, format }: { value: string; format: BarcodeFormat }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) {
      setSrc("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const bwipjs = await import("bwip-js");
        const canvas = document.createElement("canvas");
        const is2d = format === "qrcode" || format === "datamatrix";
        bwipjs.toCanvas(canvas, {
          bcid: barcodeMap[format],
          text: value,
          scale: 3,
          includetext: false,
          paddingwidth: 0,
          paddingheight: 0,
          ...(is2d ? {} : { height: 12 }),
        });
        if (!cancelled) setSrc(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelled) setSrc("");
      }
    })();

    return () => { cancelled = true; };
  }, [format, value]);

  if (!src) {
    return (
      <div
        data-label-barcode-pending="true"
        className="w-full h-full flex items-center justify-center bg-slate-100 text-[10px] text-slate-400"
        style={placeholderStyle}
      >
        BAR
      </div>
    );
  }

  return <img data-label-barcode-ready="true" src={src} alt="" className="block w-full h-full object-contain" style={fitImageStyle} />;
}

/** 라벨 이미지 요소 — 로드 실패 시 IMG placeholder로 fallback */
function LabelImageElement({ src }: { src: string }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [src]);
  if (errored) {
    return <div className="w-full h-full bg-slate-100 text-slate-400 flex items-center justify-center" style={placeholderStyle}>IMG</div>;
  }
  return <img src={src} alt="" onError={() => setErrored(true)} className="block w-full h-full object-contain" style={fitImageStyle} />;
}

function renderElementContent(element: LabelElement, data?: Record<string, unknown>) {
  const value = resolveLabelValue(data, element.sourceField, element.text ?? element.sourceField ?? "");

  if (element.type === "text") {
    return value || element.text || "TEXT";
  }

  if (element.type === "barcode") {
    return <BarcodeImage value={value || "SAMPLE"} format={element.barcodeFormat ?? "qrcode"} />;
  }

  if (element.type === "image") {
    const src = resolveBackendFileUrl(resolveLabelValue(data, element.sourceField, element.imageUrl ?? ""));
    if (!src) return <div className="w-full h-full bg-slate-100 text-slate-400 flex items-center justify-center" style={placeholderStyle}>IMG</div>;
    return <LabelImageElement src={src} />;
  }

  return null;
}

function ShapeStrokeLayer({ element, unit, scale }: { element: LabelElement; unit: RenderUnit; scale: number }) {
  if (element.type !== "box" && element.type !== "circle" && element.type !== "line") return null;

  const borderWidth = cssSize(element.lineWidth ?? 0.35, unit, scale);
  const strokeColor = element.strokeColor ?? "#111827";

  if (element.type === "line") {
    return (
      <span
        data-label-shape-stroke="line"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: borderWidth,
          background: strokeColor,
          pointerEvents: "none",
        }}
      />
    );
  }

  return (
    <span
      data-label-shape-stroke={element.type}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: element.type === "circle" ? "9999px" : undefined,
        boxShadow: `inset 0 0 0 ${borderWidth} ${strokeColor}`,
        pointerEvents: "none",
      }}
    />
  );
}

function handleClass(anchor: ResizeAnchor) {
  const base = "resize-handle absolute w-2.5 h-2.5 bg-primary border border-white shadow-sm rounded-sm z-50";
  const pos: Record<ResizeAnchor, string> = {
    nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
    ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
    sw: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
    se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
  };
  return `${base} ${pos[anchor]}`;
}

export function LabelDesignRenderer({
  design,
  data,
  unit = "px",
  scale = 4,
  selectedId,
  editable = false,
  onSelect,
  onElementPointerDown,
  onResizePointerDown,
}: LabelDesignRendererProps) {
  const elements = useMemo(
    () => [...(design.elements ?? [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [design.elements],
  );

  return (
    <div
      className="relative bg-white overflow-hidden border border-slate-400"
      style={{
        position: "relative",
        width: cssSize(design.labelWidth, unit, scale),
        height: cssSize(design.labelHeight, unit, scale),
        background: "#ffffff",
        overflow: "hidden",
        border: "1px solid #94a3b8",
        boxSizing: "border-box",
        color: "#111827",
        fontFamily: 'Arial, "Malgun Gothic", sans-serif',
      }}
    >
      {elements.map((element) => {
        const selected = selectedId === element.id;
        const commonStyle = {
          position: "absolute" as const,
          boxSizing: "border-box" as const,
          left: cssSize(element.x, unit, scale),
          top: cssSize(element.y, unit, scale),
          width: cssSize(element.width, unit, scale),
          height: cssSize(element.height, unit, scale),
          zIndex: element.zIndex ?? 1,
        };

        const content = renderElementContent(element, data);

        return (
          <div
            key={element.id}
            data-label-element={element.id}
            onPointerDown={(event) => {
              if (!editable) return;
              onSelect?.(element.id);
              onElementPointerDown?.(element.id, event);
            }}
            className={`absolute box-border ${editable ? "cursor-move select-none" : ""} ${selected ? "ring-2 ring-primary ring-offset-1" : ""}`}
            style={{
              ...commonStyle,
              color: element.textColor ?? "#111827",
              background: element.type === "box" || element.type === "circle" ? (element.fillColor ?? "transparent") : "transparent",
              borderRadius: element.type === "circle" ? "9999px" : undefined,
              fontSize: cssFont(element.fontSize, unit, scale),
              fontFamily: element.fontFamily ?? "sans-serif",
              fontWeight: element.fontWeight ?? "normal",
              textAlign: element.align ?? "left",
              lineHeight: element.type === "text" ? cssSize(element.height, unit, scale) : undefined,
              overflow: element.type === "box" || element.type === "circle" || element.type === "line" ? "visible" : "hidden",
              whiteSpace: element.type === "text" ? "nowrap" : undefined,
              textOverflow: element.type === "text" ? "ellipsis" : undefined,
            }}
          >
            {content}
            <ShapeStrokeLayer element={element} unit={unit} scale={scale} />
            {editable && selected && (["nw", "ne", "sw", "se"] as ResizeAnchor[]).map((anchor) => (
              <span
                key={anchor}
                data-resize-handle={anchor}
                className={handleClass(anchor)}
                onPointerDown={(event) => onResizePointerDown?.(element.id, anchor, event)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

interface LabelPrintRendererProps {
  items: Array<{ key: string; data: Record<string, unknown> }>;
  design: LabelDesign;
  visible: boolean;
}

export const LabelPrintRenderer = forwardRef<HTMLDivElement, LabelPrintRendererProps>(
  ({ items, design, visible }, ref) => {
    if (!visible || items.length === 0) return null;

    return (
      <div className="fixed left-[-9999px] top-0">
        <div ref={ref} className="flex flex-wrap gap-0">
          {items.map((item) => (
            <LabelDesignRenderer key={item.key} design={design} data={item.data} unit="mm" />
          ))}
        </div>
      </div>
    );
  },
);

LabelPrintRenderer.displayName = "LabelPrintRenderer";

export default LabelDesignRenderer;
