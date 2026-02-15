/**
 * @file src/app/(authenticated)/master/bom/mockData.ts
 * @description BOM/Routing 공유 목 데이터 (실제로는 API에서 조회)
 *
 * 초보자 가이드:
 * 1. **RoutingGroup**: 공정들이 모인 라우팅 그룹 마스터
 * 2. **bomRoutingLinks**: BOM 품목코드 → 라우팅그룹코드 매핑 (연결 관계)
 * 3. API 연동 시 이 파일을 제거하고 API 호출로 교체
 */
import { RoutingGroup } from "./types";

/** 라우팅 그룹 마스터 (하네스 제조 공정 조합) */
export const mockRoutingGroups: RoutingGroup[] = [
  {
    id: "rg1", routingCode: "RTG-001", routingName: "표준 절단-압착-조립", useYn: "Y",
    steps: [
      { id: "rg1-1", seq: 1, processCode: "CUT-01", processName: "전선절단", processType: "CUT", equipType: "자동", stdTime: 5.0, setupTime: 10, useYn: "Y" },
      { id: "rg1-2", seq: 2, processCode: "CRM-01", processName: "단자압착", processType: "CRM", equipType: "자동", stdTime: 3.2, setupTime: 15, useYn: "Y" },
      { id: "rg1-3", seq: 3, processCode: "ASM-01", processName: "커넥터조립", processType: "ASM", equipType: "수동", stdTime: 8.0, setupTime: 5, useYn: "Y" },
    ],
  },
  {
    id: "rg2", routingCode: "RTG-002", routingName: "절단-압착", useYn: "Y",
    steps: [
      { id: "rg2-1", seq: 1, processCode: "CUT-01", processName: "전선절단", processType: "CUT", equipType: "자동", stdTime: 4.0, setupTime: 8, useYn: "Y" },
      { id: "rg2-2", seq: 2, processCode: "CRM-01", processName: "단자압착", processType: "CRM", equipType: "자동", stdTime: 2.5, setupTime: 12, useYn: "Y" },
    ],
  },
  {
    id: "rg3", routingCode: "RTG-003", routingName: "절단-압착-열수축", useYn: "Y",
    steps: [
      { id: "rg3-1", seq: 1, processCode: "CUT-01", processName: "전선절단", processType: "CUT", equipType: "자동", stdTime: 4.0, setupTime: 10, useYn: "Y" },
      { id: "rg3-2", seq: 2, processCode: "CRM-01", processName: "단자압착", processType: "CRM", equipType: "자동", stdTime: 3.5, setupTime: 15, useYn: "Y" },
      { id: "rg3-3", seq: 3, processCode: "HSK-01", processName: "열수축", processType: "HSK", equipType: "반자동", stdTime: 2.0, setupTime: 5, useYn: "Y" },
    ],
  },
  {
    id: "rg4", routingCode: "RTG-004", routingName: "완제품 풀 공정", useYn: "Y",
    steps: [
      { id: "rg4-1", seq: 1, processCode: "CUT-01", processName: "전선절단", processType: "CUT", equipType: "자동", stdTime: 5.5, setupTime: 10, useYn: "Y" },
      { id: "rg4-2", seq: 2, processCode: "CRM-01", processName: "단자압착", processType: "CRM", equipType: "자동", stdTime: 3.2, setupTime: 15, useYn: "Y" },
      { id: "rg4-3", seq: 3, processCode: "ASM-01", processName: "커넥터조립", processType: "ASM", equipType: "수동", stdTime: 8.0, setupTime: 5, useYn: "Y" },
      { id: "rg4-4", seq: 4, processCode: "INS-01", processName: "통전검사", processType: "INS", equipType: "자동", stdTime: 2.0, setupTime: 3, useYn: "Y" },
      { id: "rg4-5", seq: 5, processCode: "OQC-01", processName: "외관검사", processType: "INS", equipType: "수동", stdTime: 3.0, setupTime: 0, useYn: "Y" },
      { id: "rg4-6", seq: 6, processCode: "PKG-01", processName: "포장", processType: "PKG", equipType: "수동", stdTime: 2.0, setupTime: 0, useYn: "Y" },
    ],
  },
  {
    id: "rg5", routingCode: "RTG-005", routingName: "절단-탈피-압착-조립", useYn: "Y",
    steps: [
      { id: "rg5-1", seq: 1, processCode: "CUT-01", processName: "전선절단", processType: "CUT", equipType: "자동", stdTime: 5.0, setupTime: 10, useYn: "Y" },
      { id: "rg5-2", seq: 2, processCode: "STP-01", processName: "피복탈피", processType: "STP", equipType: "반자동", stdTime: 3.0, setupTime: 8, useYn: "Y" },
      { id: "rg5-3", seq: 3, processCode: "CRM-01", processName: "단자압착", processType: "CRM", equipType: "반자동", stdTime: 4.0, setupTime: 15, useYn: "Y" },
      { id: "rg5-4", seq: 4, processCode: "ASM-01", processName: "커넥터조립", processType: "ASM", equipType: "수동", stdTime: 8.0, setupTime: 5, useYn: "Y" },
    ],
  },
  {
    id: "rg6", routingCode: "RTG-006", routingName: "대전류 절단-압착-열수축", useYn: "Y",
    steps: [
      { id: "rg6-1", seq: 1, processCode: "CUT-02", processName: "대전류 절단", processType: "CUT", equipType: "반자동", stdTime: 3.0, setupTime: 8, useYn: "Y" },
      { id: "rg6-2", seq: 2, processCode: "CRM-03", processName: "배터리단자 압착", processType: "CRM", equipType: "자동", stdTime: 4.5, setupTime: 15, useYn: "Y" },
      { id: "rg6-3", seq: 3, processCode: "HSK-01", processName: "열수축", processType: "HSK", equipType: "반자동", stdTime: 2.5, setupTime: 5, useYn: "Y" },
    ],
  },
  {
    id: "rg7", routingCode: "RTG-007", routingName: "절단-육각압착", useYn: "Y",
    steps: [
      { id: "rg7-1", seq: 1, processCode: "CUT-01", processName: "전선절단", processType: "CUT", equipType: "자동", stdTime: 2.0, setupTime: 5, useYn: "Y" },
      { id: "rg7-2", seq: 2, processCode: "CRM-02", processName: "압착(육각)", processType: "CRM", equipType: "반자동", stdTime: 3.5, setupTime: 12, useYn: "Y" },
    ],
  },
];

/** 초기 BOM→라우팅그룹 연결 매핑 (partCode → routingCode) */
export const initialBomRoutingLinks: Record<string, string> = {
  "H-001": "RTG-004",   // 메인 하네스 A → 완제품 풀 공정
  "H-003": "RTG-004",   // 엔진룸 하네스 → 완제품 풀 공정
  "SUB-001": "RTG-001", // 서브 하네스 B → 표준 절단-압착-조립
  "SUB-003": "RTG-005", // 엔진 센서 하네스 → 절단-탈피-압착-조립
  "SUB-004": "RTG-007", // 온도센서 케이블 → 절단-육각압착
  "SUB-005": "RTG-006", // 배터리 하네스 → 대전류 절단-압착-열수축
  // SUB-002 (전원 하네스) → 미연결 (데모용)
  // H-002 (서브 하네스 B) → 미연결 (데모용)
};
