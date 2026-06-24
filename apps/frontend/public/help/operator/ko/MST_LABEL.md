---
menuCode: MST_LABEL
audience: operator
title: 라벨관리 — 운영 가이드
summary: 라벨 템플릿(LABEL_TEMPLATES) 전체 컬럼 DB 매핑, 카테고리/소스테이블 체계, 디자인 JSON(DESIGN_DATA) 구조, CRUD API, 멀티테넌시, 트러블슈팅
tags: [기준정보, 라벨, 디자인, 마스터, 운영]
keywords: [LABEL_TEMPLATES, label-templates, DESIGN_DATA, ZPL_CODE, PRINT_MODE, IS_DEFAULT, TEMPLATE_NAME, CATEGORY, 복합키, 자연키, 카테고리, 소스테이블, 라벨디자인, 바코드, 멀티테넌시, COMPANY, PLANT_CD]
related: [MST_PART]
---

# 라벨관리 — 운영 가이드

## 시스템 목적·역할
바코드 라벨의 **디자인 템플릿을 보유하는 마스터 테이블 `LABEL_TEMPLATES`** 관리 화면입니다. 각 업무 화면(입고라벨발행·소모품라벨발행·포장 등)이 **카테고리(CATEGORY)**로 이 테이블에서 디자인을 조회해 라벨을 발행합니다. 디자인 본문은 객체 배치·라벨 크기를 담은 **JSON(`DESIGN_DATA`)**으로 저장됩니다. 이 화면 자체는 출력을 수행하지 않습니다(디자인·템플릿 CRUD 전용).

## 데이터 구조
```
LABEL_TEMPLATES (PK: TEMPLATE_NAME, CATEGORY)   ← 자연 복합키
   ├─ DESIGN_DATA (CLOB / JSON)  : 객체 배열 + 라벨 크기 + 소스테이블
   ├─ ZPL_CODE    (CLOB)         : ZPL 직접출력 코드(선택)
   ├─ CATEGORY                   : equip/jig/worker/mat_lot/box/pallet/sg (+ part)
   └─ 스코프: COMPANY, PLANT_CD
카테고리 ↔ 소스테이블 매핑:
   equip→equipment, jig→consumable, worker→worker,
   mat_lot→mat_lot, box→box, pallet→pallet, sg→sg_label
```

## ① 라벨 템플릿 — LABEL_TEMPLATES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 템플릿 이름 | `TEMPLATE_NAME` | PK 구성(VARCHAR2 200). 카테고리 안에서 유일해야 함. 화면 API 키는 `templateName::category` 형식으로 결합. |
| 카테고리 | `CATEGORY` | PK 구성(VARCHAR2 50). 라벨 분류. 허용값 `equip/jig/worker/part/mat_lot/box/pallet/sg`. 업무 화면이 이 값으로 디자인 조회. 화면 소스테이블에 1:1 매핑. |
| 디자인 데이터 | `DESIGN_DATA` | CLOB. 라벨 디자인 JSON(`version:2`, `sourceTable`, `elements[]`, `labelWidth/Height`, 바코드·텍스트 설정). 서버가 `JSON.stringify`로 저장, 조회 시 프론트가 파싱. |
| 기본 여부 | `IS_DEFAULT` | NUMBER(1) 0/1. 카테고리별 기본 템플릿. `IS_DEFAULT=Y`로 저장 시 같은 카테고리의 기존 기본을 자동 해제(단일 기본 보장). |
| ZPL 코드 | `ZPL_CODE` | CLOB(nullable). 외부 디자이너(BarTender 등)에서 만든 ZPL 직접출력 코드. `PRINT_MODE`가 ZPL/BOTH일 때 사용. |
| 인쇄 모드 | `PRINT_MODE` | VARCHAR2(20) 기본 `BROWSER`. `BROWSER`(브라우저 렌더)·`ZPL`(프린터 직접)·`BOTH`. |
| 프린터 ID | `PRINTER_ID` | VARCHAR2(36, nullable). ZPL 출력 시 기본 프린터 지정. |
| 비고 | `REMARK` | VARCHAR2(500, nullable). 관리 메모. |
| 사용 여부 | `USE_YN` | VARCHAR2(1) 기본 `Y`. 활성 여부. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | VARCHAR2(50) NOT NULL. `40` / `1000` 스코프. 조회·저장·삭제 모두 테넌트 일치 검증(`assertSameTenant`). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. `CREATED_AT/UPDATED_AT`은 `DEFAULT CURRENT_TIMESTAMP`. |

> 엔티티 `LabelTemplate`는 `PLANT_CD` 컬럼을 속성 `plant`로 매핑한다(코드에서 `template.plant`). 화면 카테고리 `part`는 DTO 허용값에는 있으나 현재 라벨관리 화면 소스테이블에는 노출되지 않는다.

## ② 디자인 JSON(DESIGN_DATA) 구조

| JSON 키 | 의미 · 운영 포인트 |
|------|------|
| `version` | 디자인 스키마 버전(현행 `2`, 객체 기반). |
| `sourceTable` | 데이터 소스(`equipment/consumable/worker/mat_lot/box/pallet/sg_label`). 카테고리와 짝을 이룸. |
| `elements[]` | 캔버스 객체 배열. 각 원소: `type`(text/barcode/box/line/circle/image), `x/y/width/height`(mm), `sourceTable/sourceField`, `barcodeFormat`, `fontSize/fontFamily/fontWeight/align`, `strokeColor/fillColor/textColor`, `lineWidth`, `imageUrl`, `zIndex`. |
| `labelWidth` / `labelHeight` | 라벨 용지 크기(mm). |
| `barcode` / `codeText` / `nameText` / `subText` | 구(舊) 단순 디자인 호환 필드(객체 미정의 시 fallback). |

## CRUD API

| 동작 | 메서드 · 경로 | 비고 |
|------|------|------|
| 목록 | `GET /master/label-templates?category=` | 카테고리/검색어 필터, 페이징. category·templateName 정렬. |
| 단건 | `GET /master/label-templates/:id` | `id`=`templateName::category`. |
| 생성 | `POST /master/label-templates` | 동일 이름+카테고리 존재 시 409 Conflict. |
| 수정/덮어쓰기 | `PUT /master/label-templates/:id` | `id`=`templateName::category`. designData 갱신. |
| 삭제 | `DELETE /master/label-templates/:id` | 테넌트 일치 검증 후 삭제. |

- 컨트롤러: `master/label-templates` (`LabelTemplateController`), 서비스 `LabelTemplateService`, 엔티티 `entities/label-template.entity.ts`.
- 모든 호출은 `@Company()` `@Plant()` 데코레이터로 테넌트 스코프가 강제됨.

## 사전 설정 (마스터·공통코드)
- 별도 공통코드는 사용하지 않음. 소스 필드(설비코드·자재 UID 등)는 프론트 `labelSources.ts`에 카테고리별로 정의되어 있고, 각 소스의 실제 마스터(설비·소모품·작업자·품목 등)가 발행 시점 데이터 공급원.
- 발행 화면은 카테고리별 **기본 템플릿(`IS_DEFAULT=Y`)**을 우선 사용하므로, 카테고리마다 기본 1건을 지정해 두는 것을 권장.

## 운영 절차
1. 신규 라벨 디자인: 소스테이블 선택 → 객체 배치 → 라벨 크기 설정 → 이름으로 저장.
2. 기존 디자인 수정: 템플릿 클릭으로 불러오기 → 편집 → 💾(덮어쓰기)로 갱신(또는 PUT).
3. 카테고리 기본 지정: `IS_DEFAULT=Y`로 저장하면 동일 카테고리 기존 기본이 자동 해제됨.
4. ZPL 직접출력이 필요한 라인은 `ZPL_CODE` 작성 + `PRINT_MODE=ZPL/BOTH` + `PRINTER_ID` 설정.

## 권한
기준정보 관리자(라벨 디자인 등록/수정/삭제). 일반 사용자는 조회·발행 화면에서 템플릿 사용만.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 충돌 오류(409) | 같은 카테고리에 동일 `TEMPLATE_NAME` 존재 | 이름 변경 또는 덮어쓰기(PUT)로 갱신 |
| 발행 화면에 디자인이 안 나옴 | 해당 카테고리에 기본 템플릿(`IS_DEFAULT=Y`) 없음 | 카테고리별 기본 1건 지정 |
| 소스 필드 값이 빈칸으로 출력 | 객체 `sourceField`가 실제 데이터에 없는 키 | 객체 속성에서 올바른 소스 필드로 재지정 |
| 회사/사업장 불일치 오류 | 다른 테넌트의 템플릿 접근 | 현재 `COMPANY/PLANT_CD` 스코프 확인(`assertSameTenant`) |
| 라벨이 잘려 출력 | `labelWidth/labelHeight` 또는 객체 좌표가 용지 초과 | 캔버스 mm·객체 위치 재조정 |
| ZPL 출력 안 됨 | `PRINT_MODE` 미설정 또는 `ZPL_CODE`/`PRINTER_ID` 누락 | PRINT_MODE=ZPL/BOTH + ZPL_CODE + PRINTER_ID 보강 |

## 데이터·연계
- 테이블: `LABEL_TEMPLATES` (PK `TEMPLATE_NAME`+`CATEGORY`)
- 연계: 입고라벨발행·소모품라벨발행·포장(박스/팔레트)·반제품 SG 라벨 등 발행 화면이 카테고리로 디자인 조회
- 소스 마스터: 설비·소모품·작업자·자재 LOT·박스·팔레트·반제품(발행 시 값 공급)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
