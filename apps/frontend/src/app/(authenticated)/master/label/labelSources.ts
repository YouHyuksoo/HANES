import { LabelCategory, LabelDesign, LabelSourceField, LabelSourceTable } from "./types";

export interface LabelSourceDefinition {
  table: LabelSourceTable;
  label: string;
  fields: LabelSourceField[];
}

export const categorySourceTable: Record<LabelCategory, LabelSourceTable> = {
  equip: "equipment",
  jig: "consumable",
  worker: "worker",
  mat_lot: "mat_lot",
  box: "box",
  pallet: "pallet",
};

export const labelSources: Record<LabelSourceTable, LabelSourceDefinition> = {
  equipment: {
    table: "equipment",
    label: "설비",
    fields: [
      { key: "equipCode", label: "설비코드", sample: "EQ-ACTUT-01" },
      { key: "equipName", label: "설비명", sample: "자동절단 설비 #1" },
      { key: "equipType", label: "설비유형", sample: "CUTTING" },
      { key: "lineCode", label: "라인", sample: "LINE-01" },
      { key: "plant", label: "사업장", sample: "1000" },
    ],
  },
  consumable: {
    table: "consumable",
    label: "소모품",
    fields: [
      { key: "conUid", label: "소모품 UID", sample: "C26061700001" },
      { key: "consumableCode", label: "소모품코드", sample: "APPCT-A" },
      { key: "consumableName", label: "소모품명", sample: "압착날 A" },
      { key: "category", label: "분류", sample: "TOOL" },
      { key: "location", label: "보관위치", sample: "JIG-01" },
      { key: "imageUrl", label: "사진 URL", sample: "/uploads/consumables/appct_a.svg" },
    ],
  },
  worker: {
    table: "worker",
    label: "작업자",
    fields: [
      { key: "workerCode", label: "작업자코드", sample: "WK-001" },
      { key: "workerName", label: "작업자명", sample: "오지훈" },
      { key: "dept", label: "부서", sample: "생산팀" },
      { key: "phone", label: "연락처", sample: "010-0000-0000" },
    ],
  },
  mat_lot: {
    table: "mat_lot",
    label: "자재 LOT",
    fields: [
      { key: "matUid", label: "자재 UID", sample: "MLT-RM260617-00001" },
      { key: "itemCode", label: "품목코드", sample: "HNS02C1ABCD" },
      { key: "itemName", label: "품목명", sample: "하네스 부품" },
      { key: "qty", label: "수량", sample: "100" },
      { key: "unit", label: "단위", sample: "EA" },
      { key: "vendor", label: "거래처", sample: "HANES" },
      { key: "lotNo", label: "LOT 번호", sample: "R26061700001" },
    ],
  },
  box: {
    table: "box",
    label: "제품포장",
    fields: [
      { key: "boxNo", label: "박스번호", sample: "BX26061700001" },
      { key: "itemCode", label: "제품코드", sample: "HNS02C1ABCD" },
      { key: "itemName", label: "제품명", sample: "하네스 완제품" },
      { key: "qty", label: "수량", sample: "20" },
      { key: "boxQty", label: "박스입수량", sample: "20" },
      { key: "palletNo", label: "파렛트번호", sample: "PLT-260617-001" },
    ],
  },
  pallet: {
    table: "pallet",
    label: "팔레트",
    fields: [
      { key: "palletNo", label: "팔레트번호", sample: "PLT2606170001" },
      { key: "boxCount", label: "박스수", sample: "12" },
      { key: "totalQty", label: "총수량", sample: "240" },
      { key: "status", label: "상태", sample: "CLOSED" },
      { key: "shipOrderNo", label: "출하지시번호", sample: "SO-260617-001" },
      { key: "customerName", label: "고객사", sample: "HANES" },
      { key: "itemCode", label: "대표제품코드", sample: "HNS02C1ABCD" },
      { key: "itemName", label: "대표제품명", sample: "하네스 완제품" },
      { key: "createdAt", label: "생성일시", sample: "2026-06-17 09:30" },
    ],
  },
};

export function getLabelSource(category: LabelCategory, sourceTable?: LabelSourceTable) {
  return labelSources[sourceTable ?? categorySourceTable[category]];
}

export function getDesignSourceFields(design: Pick<LabelDesign, "sourceFields" | "sourceTable">, category: LabelCategory) {
  return design.sourceFields?.length ? design.sourceFields : getLabelSource(category, design.sourceTable).fields;
}

export function getSampleData(
  category: LabelCategory,
  sourceTable?: LabelSourceTable,
  sourceFields?: LabelSourceField[],
): Record<string, string> {
  const fields = sourceFields?.length ? sourceFields : getLabelSource(category, sourceTable).fields;
  return Object.fromEntries(fields.map((field) => [field.key, field.sample]));
}

export function resolveLabelValue(
  data: Record<string, unknown> | undefined,
  field: string | undefined,
  fallback = "",
) {
  if (!field) return fallback;
  const value = data?.[field];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}
