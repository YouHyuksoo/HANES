/**
 * @file src/app/(authenticated)/master/label/types.ts
 * @description 라벨관리 타입 + 라벨 디자인 모델 정의
 */

/** 바코드 형식 */
export type BarcodeFormat = "qrcode" | "datamatrix" | "code39" | "code128";

/** 라벨 카테고리 */
export type LabelCategory = "equip" | "jig" | "worker" | "mat_lot" | "box" | "pallet" | "sg" | "fg";

/** 라벨 데이터 소스 */
export type LabelSourceTable = "equipment" | "consumable" | "worker" | "mat_lot" | "box" | "pallet" | "sg_label" | "fg_label";

/** 사용자가 디자인별로 구성하는 출력 필드 */
export interface LabelSourceField {
  key: string;
  label: string;
  sample: string;
}

/** 캔버스에 배치할 객체 종류 */
export type LabelElementKind = "text" | "barcode" | "box" | "line" | "circle" | "image";

/** 라벨 출력 대상 아이템 */
export interface LabelItem {
  itemKey: string;
  code: string;
  name: string;
  sub?: string;
}

/** 텍스트 요소 설정 */
export interface TextConfig {
  enabled: boolean;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: "sans-serif" | "serif" | "monospace";
  bold: boolean;
  align: "left" | "center" | "right";
}

/** 객체 기반 라벨 요소 */
export interface LabelElement {
  id: string;
  type: LabelElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceTable?: LabelSourceTable;
  sourceField?: string;
  text?: string;
  barcodeFormat?: BarcodeFormat;
  fontSize?: number;
  fontFamily?: "sans-serif" | "serif" | "monospace";
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  strokeColor?: string;
  fillColor?: string;
  textColor?: string;
  lineWidth?: number;
  imageUrl?: string;
  zIndex?: number;
}

/** 라벨 디자인 전체 설정 */
export interface LabelDesign {
  version?: 2;
  sourceTable?: LabelSourceTable;
  sourceFields?: LabelSourceField[];
  elements?: LabelElement[];
  labelWidth: number;
  labelHeight: number;
  barcode: {
    format: BarcodeFormat;
    x: number;
    y: number;
    size: number;
  };
  codeText: TextConfig;
  nameText: TextConfig;
  subText: TextConfig;
}

/** 기본 라벨 디자인 */
export const DEFAULT_DESIGN: LabelDesign = {
  version: 2,
  sourceTable: "equipment",
  labelWidth: 70,
  labelHeight: 40,
  barcode: { format: "qrcode", x: 35, y: 3, size: 18 },
  codeText: { enabled: true, x: 35, y: 25, fontSize: 10, fontFamily: "monospace", bold: true, align: "center" },
  nameText: { enabled: true, x: 35, y: 32, fontSize: 8, fontFamily: "sans-serif", bold: false, align: "center" },
  subText: { enabled: false, x: 35, y: 37, fontSize: 7, fontFamily: "sans-serif", bold: false, align: "center" },
  elements: [
    {
      id: "barcode-main",
      type: "barcode",
      x: 4,
      y: 4,
      width: 18,
      height: 18,
      sourceTable: "equipment",
      sourceField: "equipCode",
      barcodeFormat: "qrcode",
      zIndex: 10,
    },
    {
      id: "text-code",
      type: "text",
      x: 25,
      y: 5,
      width: 38,
      height: 6,
      sourceTable: "equipment",
      sourceField: "equipCode",
      fontSize: 3.2,
      fontFamily: "monospace",
      fontWeight: "bold",
      textColor: "#111827",
      zIndex: 20,
    },
    {
      id: "text-name",
      type: "text",
      x: 25,
      y: 13,
      width: 38,
      height: 6,
      sourceTable: "equipment",
      sourceField: "equipName",
      fontSize: 2.8,
      fontFamily: "sans-serif",
      textColor: "#374151",
      zIndex: 21,
    },
    {
      id: "border",
      type: "box",
      x: 1,
      y: 1,
      width: 68,
      height: 38,
      strokeColor: "#111827",
      fillColor: "transparent",
      lineWidth: 0.3,
      zIndex: 1,
    },
  ],
};

/** 자재롯트 라벨 기본 디자인 */
export const MAT_LOT_DEFAULT_DESIGN: LabelDesign = {
  version: 2,
  sourceTable: "mat_lot",
  labelWidth: 70,
  labelHeight: 50,
  barcode: { format: "qrcode", x: 15, y: 3, size: 20 },
  codeText: { enabled: true, x: 50, y: 5, fontSize: 9, fontFamily: "monospace", bold: true, align: "center" },
  nameText: { enabled: true, x: 50, y: 15, fontSize: 8, fontFamily: "sans-serif", bold: false, align: "center" },
  subText: { enabled: true, x: 50, y: 25, fontSize: 7, fontFamily: "sans-serif", bold: false, align: "center" },
  elements: [
    {
      id: "barcode-main",
      type: "barcode",
      x: 4,
      y: 4,
      width: 20,
      height: 20,
      sourceTable: "mat_lot",
      sourceField: "matUid",
      barcodeFormat: "qrcode",
      zIndex: 10,
    },
    {
      id: "text-code",
      type: "text",
      x: 28,
      y: 5,
      width: 36,
      height: 6,
      sourceTable: "mat_lot",
      sourceField: "matUid",
      fontSize: 3,
      fontFamily: "monospace",
      fontWeight: "bold",
      textColor: "#111827",
      zIndex: 20,
    },
    {
      id: "text-name",
      type: "text",
      x: 28,
      y: 13,
      width: 36,
      height: 6,
      sourceTable: "mat_lot",
      sourceField: "itemName",
      fontSize: 2.8,
      fontFamily: "sans-serif",
      textColor: "#374151",
      zIndex: 21,
    },
    {
      id: "text-lot",
      type: "text",
      x: 28,
      y: 22,
      width: 36,
      height: 5,
      sourceTable: "mat_lot",
      sourceField: "lotNo",
      fontSize: 2.4,
      fontFamily: "sans-serif",
      textColor: "#475569",
      zIndex: 22,
    },
  ],
};

/** 반제품 SG 라벨 기본 디자인 */
export const SG_LABEL_DEFAULT_DESIGN: LabelDesign = {
  version: 2,
  sourceTable: "sg_label",
  labelWidth: 70,
  labelHeight: 40,
  barcode: { format: "qrcode", x: 12, y: 3, size: 18 },
  codeText: { enabled: true, x: 50, y: 5, fontSize: 9, fontFamily: "monospace", bold: true, align: "center" },
  nameText: { enabled: true, x: 50, y: 15, fontSize: 8, fontFamily: "sans-serif", bold: false, align: "center" },
  subText: { enabled: true, x: 50, y: 25, fontSize: 7, fontFamily: "sans-serif", bold: false, align: "center" },
  elements: [
    {
      id: "barcode-main",
      type: "barcode",
      x: 4,
      y: 4,
      width: 18,
      height: 18,
      sourceTable: "sg_label",
      sourceField: "sgBarcode",
      barcodeFormat: "qrcode",
      zIndex: 10,
    },
    {
      id: "text-code",
      type: "text",
      x: 25,
      y: 5,
      width: 42,
      height: 6,
      sourceTable: "sg_label",
      sourceField: "sgBarcode",
      fontSize: 2.8,
      fontFamily: "monospace",
      fontWeight: "bold",
      textColor: "#111827",
      zIndex: 20,
    },
    {
      id: "text-name",
      type: "text",
      x: 25,
      y: 14,
      width: 42,
      height: 6,
      sourceTable: "sg_label",
      sourceField: "itemCode",
      fontSize: 3,
      fontFamily: "sans-serif",
      fontWeight: "bold",
      textColor: "#374151",
      zIndex: 21,
    },
    {
      id: "text-lot",
      type: "text",
      x: 25,
      y: 22,
      width: 42,
      height: 5,
      sourceTable: "sg_label",
      sourceField: "orderNo",
      fontSize: 2.4,
      fontFamily: "sans-serif",
      textColor: "#475569",
      zIndex: 22,
    },
    {
      id: "text-qty",
      type: "text",
      x: 4,
      y: 24,
      width: 18,
      height: 6,
      sourceTable: "sg_label",
      sourceField: "initQty",
      fontSize: 3.2,
      fontFamily: "monospace",
      fontWeight: "bold",
      align: "center",
      textColor: "#111827",
      zIndex: 23,
    },
    {
      id: "border",
      type: "box",
      x: 1,
      y: 1,
      width: 68,
      height: 38,
      strokeColor: "#111827",
      fillColor: "transparent",
      lineWidth: 0.3,
      zIndex: 1,
    },
  ],
};

/** 완제품 FG 라벨 기본 디자인 */
export const FG_LABEL_DEFAULT_DESIGN: LabelDesign = {
  version: 2,
  sourceTable: "fg_label",
  labelWidth: 70,
  labelHeight: 40,
  barcode: { format: "qrcode", x: 12, y: 3, size: 18 },
  codeText: { enabled: true, x: 50, y: 5, fontSize: 9, fontFamily: "monospace", bold: true, align: "center" },
  nameText: { enabled: true, x: 50, y: 15, fontSize: 8, fontFamily: "sans-serif", bold: false, align: "center" },
  subText: { enabled: true, x: 50, y: 25, fontSize: 7, fontFamily: "sans-serif", bold: false, align: "center" },
  elements: [
    {
      id: "barcode-main",
      type: "barcode",
      x: 4,
      y: 4,
      width: 18,
      height: 18,
      sourceTable: "fg_label",
      sourceField: "fgBarcode",
      barcodeFormat: "qrcode",
      zIndex: 10,
    },
    {
      id: "text-code",
      type: "text",
      x: 25,
      y: 5,
      width: 42,
      height: 6,
      sourceTable: "fg_label",
      sourceField: "fgBarcode",
      fontSize: 2.8,
      fontFamily: "monospace",
      fontWeight: "bold",
      textColor: "#111827",
      zIndex: 20,
    },
    {
      id: "text-name",
      type: "text",
      x: 25,
      y: 14,
      width: 42,
      height: 6,
      sourceTable: "fg_label",
      sourceField: "itemCode",
      fontSize: 3,
      fontFamily: "sans-serif",
      fontWeight: "bold",
      textColor: "#374151",
      zIndex: 21,
    },
    {
      id: "text-lot",
      type: "text",
      x: 25,
      y: 22,
      width: 42,
      height: 5,
      sourceTable: "fg_label",
      sourceField: "orderNo",
      fontSize: 2.4,
      fontFamily: "sans-serif",
      textColor: "#475569",
      zIndex: 22,
    },
    {
      id: "border",
      type: "box",
      x: 1,
      y: 1,
      width: 68,
      height: 38,
      strokeColor: "#111827",
      fillColor: "transparent",
      lineWidth: 0.3,
      zIndex: 1,
    },
  ],
};

/** 바코드 형식 옵션 */
export const BARCODE_FORMATS: { value: BarcodeFormat; label: string }[] = [
  { value: "qrcode", label: "QR Code" },
  { value: "datamatrix", label: "DataMatrix" },
  { value: "code128", label: "Code 128" },
  { value: "code39", label: "Code 39" },
];

/** 글꼴 옵션 */
export const FONT_OPTIONS = [
  { value: "sans-serif", label: "고딕" },
  { value: "serif", label: "명조" },
  { value: "monospace", label: "고정폭" },
] as const;

const categorySourceTable: Record<LabelCategory, LabelSourceTable> = {
  equip: "equipment",
  jig: "consumable",
  worker: "worker",
  mat_lot: "mat_lot",
  box: "box",
  pallet: "pallet",
  sg: "sg_label",
  fg: "fg_label",
};

export function createDefaultLabelDesign(category: LabelCategory): LabelDesign {
  if (category === "mat_lot") return MAT_LOT_DEFAULT_DESIGN;
  if (category === "sg") return SG_LABEL_DEFAULT_DESIGN;
  if (category === "fg") return FG_LABEL_DEFAULT_DESIGN;
  const sourceTable = categorySourceTable[category];
  if (category === "jig") {
    return remapDesignSource(DEFAULT_DESIGN, "consumable", {
      barcode: "conUid",
      code: "consumableCode",
      name: "consumableName",
      sub: "category",
    });
  }
  if (category === "worker") {
    return remapDesignSource(DEFAULT_DESIGN, "worker", {
      barcode: "workerCode",
      code: "workerCode",
      name: "workerName",
      sub: "dept",
    });
  }
  if (category === "box") {
    return remapDesignSource(DEFAULT_DESIGN, "box", {
      barcode: "boxNo",
      code: "boxNo",
      name: "itemName",
      sub: "qty",
    });
  }
  if (category === "pallet") {
    return remapDesignSource(DEFAULT_DESIGN, "pallet", {
      barcode: "palletNo",
      code: "palletNo",
      name: "boxCount",
      sub: "totalQty",
    });
  }
  return remapDesignSource(DEFAULT_DESIGN, sourceTable, {
    barcode: "equipCode",
    code: "equipCode",
    name: "equipName",
    sub: "lineCode",
  });
}

export function ensureObjectLabelDesign(design: LabelDesign, category: LabelCategory): LabelDesign {
  if (Array.isArray(design.elements) && design.elements.length > 0) {
    return { ...design, version: 2, sourceTable: design.sourceTable ?? categorySourceTable[category] };
  }

  const fallback = createDefaultLabelDesign(category);
  return {
    ...fallback,
    labelWidth: design.labelWidth ?? fallback.labelWidth,
    labelHeight: design.labelHeight ?? fallback.labelHeight,
  };
}

function remapDesignSource(
  design: LabelDesign,
  sourceTable: LabelSourceTable,
  fields: { barcode: string; code: string; name: string; sub: string },
): LabelDesign {
  return {
    ...design,
    sourceTable,
    elements: (design.elements ?? []).map((element) => {
      const next = { ...element, sourceTable };
      if (element.id === "barcode-main") next.sourceField = fields.barcode;
      if (element.id === "text-code") next.sourceField = fields.code;
      if (element.id === "text-name") next.sourceField = fields.name;
      if (element.id === "text-lot") next.sourceField = fields.sub;
      return next;
    }),
  };
}
