---
menuCode: QC_INSPECT
audience: operator
title: 외관검사 — 운영 가이드
summary: FG 바코드 스캔 기반 외관검사 — 합격/불합격 판정, 불량코드 입력, FG_LABELS 상태 전이(ISSUED→VISUAL_PASS/FAIL), INSPECT_RESULTS 자동 생성
tags: [품질, 검사, 외관, 운영]
keywords: [INSPECT_RESULTS, FG_LABELS, FG_BARCODE, VISUAL_DEFECT, PASS_YN, ERROR_CODE, VISUAL_PASS, VISUAL_FAIL, INSPECT_TYPE, 외관검사, FG바코드, 합격, 불합격, 불량코드, 검사실적]
related: [INSP_RESULT]
---

# 외관검사 — 운영 가이드

## 시스템 목적·역할
완제품(FG)의 **외관검사** 결과를 등록·조회하는 화면입니다. FG 바코드를 스캔하여 합격/불합격을 판정하고, 불합격 시 불량코드와 상세 사유를 기록합니다.

| 검사 결과 | FG_LABELS 상태 전이 | 설명 |
|-----------|-------------------|------|
| 합격(PASS) | `ISSUED` → `VISUAL_PASS` | 외관 양호, 다음 공정(포장)으로 진행 가능 |
| 불합격(FAIL) | `ISSUED` → `VISUAL_FAIL` | 불량 발견, 재검사 또는 폐기 대상 |

## 데이터 구조
```
FG_LABELS (PK: FG_BARCODE)
   상태 전이: ISSUED → VISUAL_PASS/VISUAL_FAIL → PACKED → SHIPPED
   외관검사 통과 시 VISUAL_PASS, 불합격 시 VISUAL_FAIL

INSPECT_RESULTS (PK: RESULT_NO, SeqGenerator INSPECT_RESULT)
   ├─ FG_BARCODE ─▶ FG_LABELS (스캔한 FG 바코드)
   ├─ PASS_YN: Y/N (합격/불합격)
   ├─ ERROR_CODE: 불량코드 (공통코드 VISUAL_DEFECT)
   └─ INSPECT_TYPE: 'VISUAL'
```

## 화면 구성
- **좌측 메인 영역**: DataGrid — 검사 이력 목록 (FG바코드·판정·불량코드·검사시간·검사원)
  - 통계 요약: 총 건수, 검사완료, 미검사, 합격률
  - 검색: 작업지시번호·품목코드, 상태·판정 필터
  - FG라벨 선택 모달: `FgLabelSelectModal` — ISSUED 상태 FG 목록에서 선택
- **우측 슬라이드 패널**: `InspectFormPanel` — 검사 등록 폼 (바코드 스캔 시 자동 오픈)
  - 제품 정보: FG바코드·품목코드·작업지시·설비코드·상태 (읽기 전용)
  - 합격/불합격 버튼 (대형 토글)
  - 불량 체크리스트: `VISUAL_DEFECT` 공통코드 불량항목별 체크박스 + 수량
  - 대표 불량코드: `VISUAL_DEFECT` 선택
  - 상세 사유: 자유 텍스트 입력

## 검사 흐름

### ① FG 바코드 스캔
`GET /quality/continuity-inspect/fg-label/{barcode}`
- 좌측 상단 스캔 입력 필드에 바코드 입력 → Enter
- FG_LABELS 조회 → 제품 정보 표시 + 우측 패널 오픈
- 이미 검사 완료된 라벨(`status !== ISSUED`): `검사 완료됨` 경고 + 저장 버튼 비활성화

### ② 합격/불합격 판정
`POST /quality/continuity-inspect/visual-inspect/{fgBarcode}`
- **합격(PASS)**: 큰 녹색 버튼 클릭 → `passYn: "Y"`로 저장
- **불합격(FAIL)**: 큰 빨간 버튼 클릭 → 불량코드·상세 사유 입력 → 저장
- 트랜잭션 처리: `InspectResult` 생성 + `FgLabel.status` 업데이트 (원자적)

### ③ 결과 확인
- 검사 이력 DataGrid 자동 갱신
- FG_LABELS 상태: `VISUAL_PASS` 또는 `VISUAL_FAIL`로 변경
- `VISUAL_PASS` → 포장 공정(`/shipping/pack`)에서 박스 포장 가능
- `VISUAL_FAIL` → 재검사 또는 폐기 처리

## 전체 컬럼 — INSPECT_RESULTS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 검사번호 | `RESULT_NO` | PK. SeqGenerator 자동 채번 (`INSPECT_RESULT`). |
| FG 바코드 | `FG_BARCODE` | `FG_LABELS.FG_BARCODE` 참조. 스캔 입력값. |
| 검사유형 | `INSPECT_TYPE` | `VISUAL`(외관검사). 본 화면에서 생성되는 레코드는 모두 VISUAL. |
| 검사범위 | `INSPECT_SCOPE` | `FULL`(전수). 외관검사는 항상 전수검사. |
| 합격여부 | `PASS_YN` | Y/N. |
| 불량코드 | `ERROR_CODE` | 공통코드 `VISUAL_DEFECT`. 불합격 시 필수. |
| 상세사유 | `ERROR_DETAIL` | 불합격 상세 텍스트. |
| 검사데이터 | `INSPECT_DATA` | CLOB. 불량 체크리스트 JSON 등 추가 데이터 저장. |
| 검사시간 | `INSPECT_TIME` | 검사 시점. Default CURRENT_TIMESTAMP. |
| 검사원 | `INSPECTOR_ID` | 검사 수행자. |
| 설비코드 | `EQUIP_CODE` | 검사기 설비코드 (외관검사는 선택값). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |

## FG_LABELS 상태 전이

| 상태 | 의미 | 다음 상태 |
|------|------|-----------|
| `ISSUED` | 라벨 발행, 미검사 | `VISUAL_PASS` 또는 `VISUAL_FAIL` |
| `VISUAL_PASS` | 외관검사 합격 | `PACKED` (포장) |
| `VISUAL_FAIL` | 외관검사 불합격 | 재검사 시 `ISSUED`로 복귀 또는 폐기 |
| `PACKED` | 포장 완료 | `SHIPPED` (출하) |
| `SHIPPED` | 출하 완료 | 종단 상태 |
| `VOIDED` | 폐기 | 종단 상태 |

## 사전 설정 (마스터·공통코드)
- 공통코드: `VISUAL_DEFECT`(외관 불량코드) — 불량코드 선택·체크리스트에 사용
- FG_LABELS: 연속공정(`/inspection/result`) 또는 FG 발행 화면에서 `ISSUED` 상태로 먼저 생성되어야 함
- 검사실적(`INSPECT_RESULTS`): SeqGenerator `INSPECT_RESULT`가 SEQ_RULES에 등록되어 있어야 함

## 권한
품질검사 담당자(외관검사 등록/조회). 관리자는 검사 이력 수정/삭제 가능 (단, 생산실적이 CANCELED 상태일 때만 삭제 가능).

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 바코드 스캔 시 조회 안 됨 | FG_LABELS에 없는 바코드 | FG 바코드 발행 확인 또는 라벨 선택 모달에서 선택 |
| 검사 등록 불가 — 이미 검사됨 | `FG_LABELS.status`가 ISSUED 아님 | 다른 상태(VISUAL_PASS/FAIL 등)인 경우 중복 검사 불가 |
| 불합격 저장 시 불량코드 선택 안 됨 | `VISUAL_DEFECT` 공통코드 미등록 | 공통코드에 외관 불량코드 등록 |
| 검사 이력 목록에 방금 검사 건 안 보임 | 새로고침 전 | DataGrid는 저장 후 자동 갱신됨, 수동 새로고침도 가능 |
| FG 선택 모달에 라벨 없음 | 모든 FG가 이미 ISSUED 아님 | 검사 대상 FG가 ISSUED 상태인지 확인 |
| 검사실적 삭제 안 됨 | 생산실적이 CANCELED 상태 아님 | 삭제는 생산실적 취소 후 가능 (일반적으로 이력 보존) |

## 데이터·연계
- 테이블: `INSPECT_RESULTS`, `FG_LABELS`
- 연계: 연속공정 통전검사(`/inspection/result`), 제품포장(`/shipping/pack`), 불량코드관리(`/quality/defect-code`), 추적관리(`/quality/trace`)
- 검사번호 채번: `SEQ_RULES` 코드 `INSPECT_RESULT`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
