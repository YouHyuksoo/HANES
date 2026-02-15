/**
 * @file src/app/(authenticated)/master/label/types.ts
 * @description 라벨관리 타입 + 라벨 디자인 모델 정의
 */

/** 바코드 형식 */
export type BarcodeFormat = "qrcode" | "datamatrix" | "code39" | "code128";

/** 라벨 카테고리 */
export type LabelCategory = "equip" | "jig" | "worker" | "part";

/** 라벨 출력 대상 아이템 */
export interface LabelItem {
  id: string;
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

/** 라벨 디자인 전체 설정 */
export interface LabelDesign {
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
  labelWidth: 70,
  labelHeight: 40,
  barcode: { format: "qrcode", x: 35, y: 3, size: 18 },
  codeText: { enabled: true, x: 35, y: 25, fontSize: 10, fontFamily: "monospace", bold: true, align: "center" },
  nameText: { enabled: true, x: 35, y: 32, fontSize: 8, fontFamily: "sans-serif", bold: false, align: "center" },
  subText: { enabled: false, x: 35, y: 37, fontSize: 7, fontFamily: "sans-serif", bold: false, align: "center" },
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
