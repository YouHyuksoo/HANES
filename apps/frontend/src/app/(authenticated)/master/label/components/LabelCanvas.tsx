"use client";

/**
 * @file src/app/(authenticated)/master/label/components/LabelCanvas.tsx
 * @description 라벨 디자인 실시간 미리보기 캔버스 - 설정 반영 WYSIWYG 표시
 *
 * 초보자 가이드:
 * 1. **스케일**: mm 단위 → 화면 px 변환 (scale 배율 적용)
 * 2. **바코드**: BarcodeCanvas를 지정 위치에 렌더링
 * 3. **텍스트**: 코드/명칭/부가정보를 디자인 설정대로 배치
 */
import BarcodeCanvas from "./BarcodeCanvas";
import { LabelDesign, TextConfig } from "../types";

interface LabelCanvasProps {
  design: LabelDesign;
  sampleCode?: string;
  sampleName?: string;
  sampleSub?: string;
}

/** mm → px 변환 배율 */
const SCALE = 4;

/** 텍스트 요소 렌더링 */
function DesignText({ config, text, widthMm }: { config: TextConfig; text: string; widthMm: number }) {
  if (!config.enabled) return null;
  return (
    <div
      className="absolute whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none"
      style={{
        left: `${config.x * SCALE}px`,
        top: `${config.y * SCALE}px`,
        transform: config.align === "center" ? "translateX(-50%)" : config.align === "right" ? "translateX(-100%)" : "none",
        fontSize: `${config.fontSize * SCALE * 0.35}px`,
        fontFamily: config.fontFamily,
        fontWeight: config.bold ? "bold" : "normal",
        textAlign: config.align,
        maxWidth: `${widthMm * SCALE * 0.9}px`,
        color: "#000",
      }}
    >
      {text}
    </div>
  );
}

export default function LabelCanvas({
  design,
  sampleCode = "EQ-CUT-001",
  sampleName = "Sample Name",
  sampleSub = "Info",
}: LabelCanvasProps) {
  const w = design.labelWidth * SCALE;
  const h = design.labelHeight * SCALE;
  const bcSize = design.barcode.size * SCALE;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative bg-white border-2 border-dashed border-gray-300 overflow-hidden"
        style={{ width: `${w}px`, height: `${h}px` }}
      >
        {/* 바코드 영역 */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${design.barcode.x * SCALE - bcSize / 2}px`,
            top: `${design.barcode.y * SCALE}px`,
            width: `${bcSize}px`,
            height: `${bcSize}px`,
          }}
        >
          <BarcodeCanvas value={sampleCode} format={design.barcode.format} />
        </div>

        {/* 텍스트 요소들 */}
        <DesignText config={design.codeText} text={sampleCode} widthMm={design.labelWidth} />
        <DesignText config={design.nameText} text={sampleName} widthMm={design.labelWidth} />
        <DesignText config={design.subText} text={sampleSub} widthMm={design.labelWidth} />
      </div>

      {/* 크기 표시 */}
      <span className="text-xs text-text-muted">
        {design.labelWidth} x {design.labelHeight} mm
      </span>
    </div>
  );
}
