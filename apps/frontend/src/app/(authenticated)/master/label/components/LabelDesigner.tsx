"use client";

/**
 * @file src/app/(authenticated)/master/label/components/LabelDesigner.tsx
 * @description 라벨 디자인 설정 패널 - 용지/바코드/텍스트 위치, 크기, 폰트 설정
 *
 * 초보자 가이드:
 * 1. **용지 크기**: 라벨 가로/세로 mm 설정
 * 2. **바코드**: 형식, 위치(X/Y), 크기 설정
 * 3. **텍스트**: 코드/명칭/부가정보별 활성화, 위치, 폰트 설정
 */
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";
import { LabelDesign, BarcodeFormat, BARCODE_FORMATS } from "../types";
import TextSection, { NumInput } from "./TextSection";

interface LabelDesignerProps {
  design: LabelDesign;
  onChange: (design: LabelDesign) => void;
}

export default function LabelDesigner({ design, onChange }: LabelDesignerProps) {
  const { t } = useTranslation();
  const formatOpts = BARCODE_FORMATS.map((f) => ({ value: f.value, label: f.label }));

  const update = <K extends keyof LabelDesign>(key: K, val: LabelDesign[K]) =>
    onChange({ ...design, [key]: val });

  return (
    <div className="space-y-4 text-sm">
      {/* 용지 크기 */}
      <div>
        <h4 className="text-xs font-semibold text-text mb-2">{t("master.label.paperSize")}</h4>
        <div className="grid grid-cols-2 gap-2">
          <NumInput label={t("master.label.widthMm")} value={design.labelWidth} onChange={(v) => update("labelWidth", v)} min={20} max={200} />
          <NumInput label={t("master.label.heightMm")} value={design.labelHeight} onChange={(v) => update("labelHeight", v)} min={15} max={150} />
        </div>
      </div>

      <hr className="border-border" />

      {/* 바코드 설정 */}
      <div>
        <h4 className="text-xs font-semibold text-text mb-2">{t("master.label.barcodeSection")}</h4>
        <div className="space-y-2">
          <Select
            label={t("master.label.barcodeFormat")}
            options={formatOpts} value={design.barcode.format}
            onChange={(v) => update("barcode", { ...design.barcode, format: v as BarcodeFormat })}
            fullWidth
          />
          <div className="grid grid-cols-3 gap-2">
            <NumInput label={t("master.label.posX")} value={design.barcode.x} onChange={(v) => update("barcode", { ...design.barcode, x: v })} />
            <NumInput label={t("master.label.posY")} value={design.barcode.y} onChange={(v) => update("barcode", { ...design.barcode, y: v })} />
            <NumInput label={t("master.label.barcodeSizeMm")} value={design.barcode.size} onChange={(v) => update("barcode", { ...design.barcode, size: v })} min={5} max={50} />
          </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* 텍스트 요소 */}
      <TextSection
        title={t("master.label.codeTextSection")}
        config={design.codeText}
        onChange={(c) => update("codeText", c)}
      />
      <hr className="border-border" />
      <TextSection
        title={t("master.label.nameTextSection")}
        config={design.nameText}
        onChange={(c) => update("nameText", c)}
      />
      <hr className="border-border" />
      <TextSection
        title={t("master.label.subTextSection")}
        config={design.subText}
        onChange={(c) => update("subText", c)}
      />
    </div>
  );
}
