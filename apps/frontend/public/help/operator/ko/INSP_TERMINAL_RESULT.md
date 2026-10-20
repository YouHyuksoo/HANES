---
menuCode: INSP_TERMINAL_RESULT
audience: operator
title: 절압물검사 — 운영 가이드
summary: 압착 작업지시를 BOM 단자별 TERMINAL_CRIMP_SPECS로 서버 판정하고 INSPECT_RESULTS(TERMINAL)에 기록하는 구조와 운영 절차
tags: [검사관리, 압착, 절압물, 운영]
keywords: [절압물검사, INSP_TERMINAL_RESULT, INSPECT_RESULTS, TERMINAL, ORDER_NO, TERMINAL_CRIMP_SPECS, BOM_MASTERS, CRIMP_VISUAL_CHECK, crimp-inspect, CRINS, CRIMPING, judgeCrimpSide]
related: [QC_TERMINAL_CRIMP_SPEC, INSP_HISTORY, MST_PART]
---

# 절압물검사 — 운영 가이드

## 시스템 목적·역할
THN 공정표의 **절압물 검사**(저전압) / **QC검사**(고전압) 단계입니다. 절단·압착한 반제품을 조립 전에 압착 규격으로 판정합니다.
라우팅의 `CRINS 절압물검사` 공정은 `JOB_ORDER_YN='N'`이라 작업지시가 생기지 않으므로, 결과는 바로 앞 **압착 작업지시**(공정유형 `CRIMPING`)에 겁니다.
메뉴코드·경로(`INSP_TERMINAL_RESULT`, `/inspection/terminal-result`)와 검사유형 코드 `TERMINAL`은 예전 단자검사의 것을 그대로 쓰고, 공통코드 명칭만 `절압물`로 바꿨습니다.

## 데이터 구조
```
JOB_ORDERS (PROCESS_CODE → PROCESS_MASTERS.PROCESS_TYPE='CRIMPING', STATUS IN RUNNING/WAITING)
  └ ITEM_CODE → BOM_MASTERS (USE_YN='Y', 오늘 유효)
       ├ 자품목 ITEM_MASTERS.PRODUCT_TYPE='TERMINAL'  → 단자 사이드 (sideKey = 단자 품목코드)
       └ 자품목 PRODUCT_TYPE='WIRE' (없으면 SEMI_PRODUCT 자품목 BOM을 단계별로 내려가 전선이 처음 나오는 단계, 최대 10단계)
  단자 × 전선 → TERMINAL_CRIMP_SPECS (TERMINAL_ITEM_CODE, WIRE_ITEM_CODE 정확 일치, USE_YN='Y', 1건)
결과 → INSPECT_RESULTS (INSPECT_TYPE='TERMINAL', INSPECT_SCOPE='SAMPLE', ORDER_NO)
스코프: 모든 조회·저장에 COMPANY, PLANT_CD 포함
```

## ① 검사 결과 — INSPECT_RESULTS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 결과번호 | `RESULT_NO` | `SEQ_RULES 'INSPECT_RESULT'` 채번 |
| 작업지시 | `ORDER_NO` | 2026-10-20 추가 컬럼. 절압물검사는 실적·FG 라벨 이전에도 기록하므로 작업지시를 직접 건다. 인덱스 `IX_INSPECT_RESULTS_ORDER (COMPANY, PLANT_CD, ORDER_NO, INSPECT_TYPE)` |
| 검사유형 | `INSPECT_TYPE` | 항상 `TERMINAL` (공통코드명 `절압물`) |
| 검사범위 | `INSPECT_SCOPE` | 항상 `SAMPLE` (초·중·종물 샘플) |
| 판정 | `PASS_YN` | 서버 재판정 결과 |
| 불량 구분 | `ERROR_CODE` | 규격 이탈 `SPEC`, 규격은 합격이고 외관 NG만 있으면 `VISUAL`, 합격이면 NULL |
| 판정 내용 | `ERROR_DETAIL` | 불합격: `단자 항목 값 (범위)` + `외관 {명칭} NG` + 비고를 `; `로 연결(500자). 합격: 비고 |
| 측정 데이터 | `INSPECT_DATA` | JSON `{timing, processCode, itemCode, sides:[{sideKey, side, terminalItemCode, wireItemCode, specId, measured, passYn, failures}], visualChecks:[{code,result}], remark}` |
| 검사자 | `INSPECTOR_ID` | `WORKER_MASTERS.WORKER_CODE` (사용중만 허용) |
| 등록자 | `CREATED_BY` | 로그인 사용자 |
| FG/회로라벨/실적 | `FG_BARCODE`·`CIRCUIT_LABEL`·`PROD_RESULT_ID` | 절압물검사는 쓰지 않는다(NULL) |

## 버튼·API·상태 전이

| 버튼/액션 | API 또는 서비스 | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| 목록 조회/새로고침 | `GET /quality/crimp-inspect/job-orders` | — | 조회만. `INSPECT_RESULTS(TERMINAL)` 건수·불합격 건수 집계 포함 |
| 작업지시 선택 | `GET /quality/crimp-inspect/context?orderNo=` | 압착 작업지시 | 단자 사이드별 `status`(OK/NO_WIRE/MULTI_WIRE/NO_SPEC/DUP_SPEC)·규격·외관 항목 반환. `ready=false`면 등록 버튼 비활성 |
| 이력 | `GET /quality/crimp-inspect/history?orderNo=` | — | `ORDER_NO`+`TERMINAL` 최근 100건 |
| 판정 등록 | `POST /quality/crimp-inspect` → `CrimpInspectService.create` | 작업지시 공정유형 CRIMPING·취소 아님, 사용중 작업자, 모든 사이드 OK, 규격 대상 측정값 전부, 사용중 외관 항목 전부 | 트랜잭션 1건 INSERT `INSPECT_RESULTS`. 작업지시·실적·재고 상태는 바꾸지 않는다 |

[키패드] 토글은 화면 전용이다(API·DB 영향 없음). 켜짐 여부는 브라우저 `localStorage` `crimpInspect.keypadOpen`(Y/N)에만 기억하고, 읽기 실패 시 꺼짐으로 시작한다. 키패드 컴포넌트는 공용 `components/shared/NumericKeypad.tsx`.

예전 FG 라벨 경로(`POST /quality/continuity-inspect/inspect`)는 `inspectType=TERMINAL`을 더 이상 받지 않는다(DTO `@IsIn`에서 제외, 회로라벨 필수 유형에서도 제외).

## 판정 로직
- 함수: `@harness/shared` `judgeCrimpSide` / `crimpMeasureTargets` / `isCrimpValueInSpec` (`packages/shared/src/utils/crimp-measurement-spec.ts`). 화면 표시와 서버 판정이 같은 함수를 쓴다.
- 측정 대상: 규격에 하한·상한 중 하나라도 있는 항목. 압착고 `CRIMP_HEIGHT_LSL/USL`, 압착폭 `CRIMP_WIDTH_LSL/USL`, 절연부 `INS_CRIMP_HEIGHT_LSL/USL`, 인장력 `PULL_FORCE_MIN`(하한만), 탈피 `STRIP_LENGTH_MIN/MAX`.
- 대상 항목 값이 없으면 400(저장 안 함). 범위 밖이면 그 사이드 불합격.
- 최종 `PASS_YN='Y'` = 모든 사이드 합격 AND 모든 외관 항목 OK.
- 규격 매칭은 (단자 품목, 전선 품목) **정확 일치만** 쓴다. `WIRE_ITEM_CODE`가 빈 사이즈 행(예: `0.5SQ`)으로 대신 판정하지 않는다.

## 사전 설정 (마스터·공통코드)
1. [단자별 압착 규격] `TERMINAL_CRIMP_SPECS`: 단자 품목 + **전선 품목**을 지정한 사용중 행이 조합당 1건.
2. BOM: 압착 품목의 자품목에 `PRODUCT_TYPE='TERMINAL'` 단자, `PRODUCT_TYPE='WIRE'` 전선. 압착 품목에 전선이 없으면 반제품 BOM을 단계별로 내려가며, 전선이 처음 나오는 단계에 전선이 1종이어야 한다(예: `N91H00-X9800-S-A` → `S-AB` → `C1` → `C1-A`의 `1SH21A7A09`). 그 단계에 2종 이상이면 `MULTI_WIRE`로 막는다.
3. 공통코드 `CRIMP_VISUAL_CHECK`: `SHAPE` 압착형상, `MIXUP` 이종, `MISSING` 누락, `APPEARANCE` 외관불량. 항목을 추가하면 화면·서버 필수 항목에 바로 반영된다.
4. 공통코드 `INSPECT_TYPE.TERMINAL` = `절압물`.
5. 마이그레이션: `apps/backend/src/migrations/2026-10-20_crimp_inspect.sql`.

## 운영 절차
1. 신규 단자/전선 조합 투입 전 규격과 BOM 전선 구성을 확인한다.
2. 작업지시 선택 시 빨간 사유가 나오면 해당 마스터를 고친 뒤 작업지시를 다시 선택한다.
3. 불합격 이력은 `ERROR_DETAIL`과 `INSPECT_DATA.sides[].failures`로 원인 항목을 확인한다.

## 권한
- 메뉴 `INSP_TERMINAL_RESULT`: `MENU_CATEGORY_ITEMS`(INSPECTION) + `ROLE_MENU_PERMISSIONS`(MANAGER, OPERATOR). 메뉴코드는 바뀌지 않아 권한 재설정이 필요 없다.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| `BOM에서 전선을 찾을 수 없음` | 압착 품목과 그 아래 반제품 BOM 어디에도 WIRE 자품목 없음 | BOM 구성 확인 |
| `규격 미등록` | `WIRE_ITEM_CODE` 미지정 또는 다른 전선 품목으로 등록 | 규격 행에 실제 BOM 전선 품목 지정 |
| `규격 중복` | 같은 단자+전선 사용중 행 2건 이상 | 하나를 미사용 처리 |
| `실측값이 없습니다: 인장력` | 규격 대상 항목 미입력(API 직접 호출 등) | 해당 값 입력 |
| `압착 공정 작업지시가 아닙니다` | 작업지시 공정의 `PROCESS_TYPE`이 CRIMPING 아님 | 공정 마스터의 공정유형 확인 |

## 데이터·연계
- [검사이력] `/inspection/history`: `INSPECT_RESULTS` 전체를 조회하므로 `TERMINAL`(절압물검사) 행도 나온다. FG 바코드는 비어 있다.
- 코드: `apps/backend/src/modules/quality/crimp-inspect/`, 화면 `apps/frontend/src/app/(authenticated)/inspection/terminal-result/`.
- 자주검사(키오스크, `SELF_INSPECT_RESULTS`)의 압착 항목과는 별개 기록이다.
