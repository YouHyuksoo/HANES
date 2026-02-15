/**
 * @file src/app/(authenticated)/master/iqc-item/types.ts
 * @description IQC 검사항목 마스터 + 검사그룹 타입/시드 데이터
 *
 * 초보자 가이드:
 * 1. **IqcItemMaster**: 개별 검사항목 (항목코드 IQC-xxx)
 * 2. **IqcGroup**: 검사그룹 = 항목 묶음 + 검사형태(전수/샘플/무검사)
 * 3. 품목 마스터에서는 검사그룹 코드만 선택하여 연결
 */

export interface IqcItemMaster {
  id: string;
  itemCode: string;
  itemName: string;
  judgeMethod: "VISUAL" | "MEASURE";
  criteria: string;
  lsl?: number;
  usl?: number;
  unit?: string;
  useYn: string;
}

export type InspectMethod = "FULL" | "SAMPLE" | "SKIP";

/** 검사그룹 = 항목 묶음 + 검사형태 */
export interface IqcGroup {
  id: string;
  groupCode: string;
  groupName: string;
  inspectMethod: InspectMethod;
  sampleQty?: number;
  itemCodes: string[];
}

export const JUDGE_METHOD_COLORS: Record<string, string> = {
  VISUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  MEASURE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
};

export const INSPECT_METHOD_COLORS: Record<string, string> = {
  FULL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  SAMPLE: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  SKIP: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

/* ── 시드: 개별 검사항목 ── */
export const seedIqcItems: IqcItemMaster[] = [
  { id: "1", itemCode: "IQC-001", itemName: "외관검사(전선)", judgeMethod: "VISUAL", criteria: "이물/손상 없을것", useYn: "Y" },
  { id: "2", itemCode: "IQC-002", itemName: "도체저항(소선)", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 20, usl: 26, unit: "Ω/km", useYn: "Y" },
  { id: "3", itemCode: "IQC-003", itemName: "피복두께", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 0.4, usl: 0.6, unit: "mm", useYn: "Y" },
  { id: "4", itemCode: "IQC-004", itemName: "외관검사(단자)", judgeMethod: "VISUAL", criteria: "변형/부식 없을것", useYn: "Y" },
  { id: "5", itemCode: "IQC-005", itemName: "도금두께", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 0.5, usl: 1.2, unit: "μm", useYn: "Y" },
  { id: "6", itemCode: "IQC-006", itemName: "삽입력", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 5, usl: 20, unit: "N", useYn: "Y" },
  { id: "7", itemCode: "IQC-007", itemName: "외관검사(커넥터)", judgeMethod: "VISUAL", criteria: "크랙/변형 없을것", useYn: "Y" },
  { id: "8", itemCode: "IQC-008", itemName: "치수검사", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 19.8, usl: 20.2, unit: "mm", useYn: "Y" },
  { id: "9", itemCode: "IQC-009", itemName: "유효기한확인", judgeMethod: "VISUAL", criteria: "제조일 기준 유효기간 이내", useYn: "Y" },
  { id: "10", itemCode: "IQC-010", itemName: "점도측정", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 200, usl: 400, unit: "cP", useYn: "Y" },
  { id: "11", itemCode: "IQC-011", itemName: "도체저항(대선)", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 4.5, usl: 6.5, unit: "Ω/km", useYn: "Y" },
  { id: "12", itemCode: "IQC-012", itemName: "편조상태검사", judgeMethod: "VISUAL", criteria: "편조 풀림/손상 없을것", useYn: "Y" },
  { id: "13", itemCode: "IQC-013", itemName: "도체저항(중선)", judgeMethod: "MEASURE", criteria: "규격 이내", lsl: 12, usl: 16, unit: "Ω/km", useYn: "Y" },
  { id: "14", itemCode: "IQC-014", itemName: "내전압시험", judgeMethod: "MEASURE", criteria: "절연파괴 없을것", lsl: 1000, unit: "V", useYn: "Y" },
];

/* ── 시드: 검사그룹 ── */
export const seedIqcGroups: IqcGroup[] = [
  { id: "g1", groupCode: "IGR-001", groupName: "전선류 검사", inspectMethod: "SAMPLE", sampleQty: 5, itemCodes: ["IQC-001", "IQC-002", "IQC-003"] },
  { id: "g2", groupCode: "IGR-002", groupName: "대선/편조선 검사", inspectMethod: "FULL", itemCodes: ["IQC-012", "IQC-011"] },
  { id: "g3", groupCode: "IGR-003", groupName: "중선류 검사", inspectMethod: "SAMPLE", sampleQty: 3, itemCodes: ["IQC-001", "IQC-013"] },
  { id: "g4", groupCode: "IGR-004", groupName: "단자류 검사(정밀)", inspectMethod: "SAMPLE", sampleQty: 10, itemCodes: ["IQC-004", "IQC-005", "IQC-006"] },
  { id: "g5", groupCode: "IGR-005", groupName: "단자류 검사(기본)", inspectMethod: "SAMPLE", sampleQty: 10, itemCodes: ["IQC-004", "IQC-005"] },
  { id: "g6", groupCode: "IGR-006", groupName: "커넥터류 검사(정밀)", inspectMethod: "SAMPLE", sampleQty: 5, itemCodes: ["IQC-007", "IQC-008"] },
  { id: "g7", groupCode: "IGR-007", groupName: "커넥터류 검사(기본)", inspectMethod: "SAMPLE", sampleQty: 5, itemCodes: ["IQC-007"] },
  { id: "g8", groupCode: "IGR-008", groupName: "유수명자재 검사", inspectMethod: "SAMPLE", sampleQty: 1, itemCodes: ["IQC-009", "IQC-010"] },
  { id: "g9", groupCode: "IGR-009", groupName: "무검사", inspectMethod: "SKIP", itemCodes: [] },
];
