---
menuCode: EQUIP_HISTORY
audience: operator
title: 점검이력 조회 — 운영 가이드
summary: EQUIP_INSPECT_LOGS 테이블 전체 점검 이력(DAILY+PERIODIC) 통합 조회, 필터 조건, 백엔드 쿼리 구조
tags: [설비, 점검, 이력, 운영, 통합조회, DAILY, PERIODIC]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_HISTORY, 점검이력조회, INSPECT_TYPE, OVERALL_RESULT, 통합조회API, 데이터그리드]
related: [EQUIP_DAILY, EQUIP_PERIODIC]
---

# 점검이력 조회 — 운영 가이드

## 시스템 목적·역할
`EQUIP_INSPECT_LOGS` 테이블의 모든 레코드(DAILY + PERIODIC)를 통합 조회합니다. 조회 전용(read-only)이며, 백엔드 `InspectHistoryController`가 `EquipInspectService.findAll()`을 `inspectType` 조건 없이 호출하여 전체 타입의 이력을 반환합니다.

## 데이터 구조
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE: 'DAILY' 또는 'PERIODIC' (조회 시 조건 없음 → 전체)
    ├── OVERALL_RESULT: 'PASS' / 'FAIL' / 'CONDITIONAL'
    ├── EQUIP_CODE → EQUIP_MASTERS (설비코드·설비명·설비유형 JOIN)
    └── 프론트 DataGrid에서 컬럼 필터·정렬·내보내기 지원
```

## API 구조

### 점검이력 목록 조회
`GET /equipment/inspect-history?search={text}&inspectType={type}&equipType={type}&overallResult={result}&inspectDateFrom={date}&inspectDateTo={date}&limit=5000`

- `search`: 설비코드 또는 설비명 부분 검색
- `inspectType`: `'DAILY'` / `'PERIODIC'` (미지정 시 전체)
- `equipType`: 공통코드 `EQUIP_TYPE` 값
- `overallResult`: `'PASS'` / `'FAIL'` / `'CONDITIONAL'`
- `inspectDateFrom` / `inspectDateTo`: 점검일 범위

### 통계 요약
`GET /equipment/inspect-history/summary` — 점검 통계 데이터

## 컬럼 매핑

| 화면 컬럼 | DB 컬럼 | JOIN |
|---------|---------|------|
| 점검일 | `LOG.INSPECT_DATE` | - |
| 점검유형 | `LOG.INSPECT_TYPE` | - |
| 설비코드 | `LOG.EQUIP_CODE` | - |
| 설비명 | `EQ.EQUIP_NAME` | `EQUIP_MASTERS` |
| 설비유형 | `EQ.EQUIP_TYPE` | `EQUIP_MASTERS` |
| 점검자 | `LOG.INSPECTOR_NAME` | - |
| 결과 | `LOG.OVERALL_RESULT` | - |
| 비고 | `LOG.REMARK` | - |

## 권한
조회는 전체 사용자. Excel 내보내기는 로그인 사용자.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 조회 결과 없음 | 필터 조건이 너무 좁음 | 필터를 넓혀서 재조회 |
| 점검일 기간 필터가 안 됨 | 날짜 형식 불일치 | YYYY-MM-DD 형식 확인 |
| 특정 설비 이력이 안 보임 | 설비 삭제 또는 EQUIP_CODE 변경 | 설비 마스터 확인 |
| Excel 내보내기 실패 | 데이터 양 과다 | 기간을 좁혀서 내보내기 |

## 데이터·연계
- **테이블**: `EQUIP_INSPECT_LOGS` (전체), `EQUIP_MASTERS` (설비명/유형 JOIN)
- **컨트롤러**: `InspectHistoryController` (독립 컨트롤러, `findAll()` 호출 시 inspectType 미고정)
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
