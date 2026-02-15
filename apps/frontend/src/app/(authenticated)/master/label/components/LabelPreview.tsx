"use client";

/**
 * @file src/app/(authenticated)/master/label/components/LabelPreview.tsx
 * @description 라벨 인쇄 미리보기 + 인쇄 - LabelDesign 설정을 반영하여 출력
 *
 * 초보자 가이드:
 * 1. **미리보기**: 선택된 아이템들을 디자인 설정대로 표시
 * 2. **인쇄**: 새 창을 열어 인쇄 (디자인 설정 반영)
 */
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";
import BarcodeCanvas from "./BarcodeCanvas";
import { LabelItem, LabelDesign } from "../types";

interface LabelPreviewProps {
  items: LabelItem[];
  design: LabelDesign;
}

export default function LabelPreview({ items, design }: LabelPreviewProps) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Label Print</title>
      <style>
        body { margin: 0; font-family: sans-serif; }
        .label-grid { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; }
        .label-card { border: 1px dashed #ccc; position: relative; overflow: hidden;
          width: ${design.labelWidth}mm; height: ${design.labelHeight}mm;
          page-break-inside: avoid; box-sizing: border-box; }
        .bc { position: absolute; display: flex; align-items: center; justify-content: center; }
        .txt { position: absolute; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        canvas { max-width: 100%; max-height: 100%; }
        @media print { .label-card { border: 1px dashed #ddd; } }
      </style></head><body>
      <div class="label-grid">${printRef.current.innerHTML}</div>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-text-muted border border-dashed border-border rounded-lg">
        <p className="text-sm">{t("master.label.selectItems")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-text-muted">
          {t("master.label.selectedCount", { count: items.length })}
        </span>
        <Button size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-1" />{t("master.label.printSelected")}
        </Button>
      </div>

      <div className="overflow-auto max-h-[300px] border border-border rounded-lg p-2 bg-white dark:bg-background">
        <div ref={printRef} className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-dashed border-border rounded relative overflow-hidden"
              style={{
                width: `${design.labelWidth}mm`,
                height: `${design.labelHeight}mm`,
                minWidth: "80px",
                minHeight: "60px",
              }}
            >
              <div className="absolute flex items-center justify-center" style={{
                left: `${(design.barcode.x / design.labelWidth) * 100}%`,
                top: `${(design.barcode.y / design.labelHeight) * 100}%`,
                transform: "translateX(-50%)",
                width: `${(design.barcode.size / design.labelWidth) * 100}%`,
              }}>
                <BarcodeCanvas value={item.code} format={design.barcode.format} />
              </div>
              {design.codeText.enabled && (
                <div className="absolute w-full text-center truncate" style={{
                  top: `${(design.codeText.y / design.labelHeight) * 100}%`,
                  fontSize: `${design.codeText.fontSize * 0.8}px`,
                  fontFamily: design.codeText.fontFamily,
                  fontWeight: design.codeText.bold ? "bold" : "normal",
                  textAlign: design.codeText.align,
                  left: 0, right: 0, padding: "0 4px",
                }}>{item.code}</div>
              )}
              {design.nameText.enabled && (
                <div className="absolute w-full text-center truncate text-gray-500" style={{
                  top: `${(design.nameText.y / design.labelHeight) * 100}%`,
                  fontSize: `${design.nameText.fontSize * 0.8}px`,
                  fontFamily: design.nameText.fontFamily,
                  fontWeight: design.nameText.bold ? "bold" : "normal",
                  textAlign: design.nameText.align,
                  left: 0, right: 0, padding: "0 4px",
                }}>{item.name}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
