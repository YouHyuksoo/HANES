---
menuCode: MST_PART
audience: operator
title: 품목마스터
summary: 원자재·반제품·완제품·소모품 등 모든 품목의 식별·분류·규격·IQC·포장 기준을 등록·관리하는 화면
tags: [기준정보, 품목, 마스터, ITEM_MASTERS, IQC]
keywords: [품목코드, 품번, ITEM_MASTERS, IQC_AQL_POLICIES, AQL, ERP, INTERFACE_INBOUND_ITEM_MASTER, ITEM_TYPE, PRODUCT_TYPE, DEFECT_MODEL_GROUP, UNIT_TYPE, IQC_INSPECT_METHOD, 이미지업로드]
related: [QC_AQL, QC_IQC_PART_SPEC]
---

# 품목마스터 — 운영자 도움말

## 아키텍처 개요
- **파일 위치**: `apps/frontend/src/app/(authenticated)/master/part/`
- **메인 페이지**: `page.tsx` — 필터 + DataGrid + 우측 슬라이드 패널 조합
- **그리드 컬럼 정의**: `partColumns.tsx`
- **폼 패널**: `components/PartFormPanel.tsx` — 슬라이드 패널 내 모든 입력 필드
- **필드 도움말**: `components/PartFieldHelp.tsx` — 각 필드의 DB 컬럼 매핑
- **타입 정의**: `types.ts` — `Part` 인터페이스 (ITEM_MASTERS 매핑)
- **i18n**: `ko.json` — `"master.part"` → "품목관리", `"master.part.iqc.*"` 라벨
- **공용 규칙**: `@harness/shared` → `requiresIqcAqlPolicy` (IQC대상=Y + 검사구분=FULL → AQL 정책 필수)

---

## ① 파일 구조

```
master/part/
├── page.tsx                       # 메인 페이지 (필터, DataGrid, 패널 조정)
├── page.client.tsx                # 상황검사 페이지 (별도 라우트 /master/part/{id})
├── partColumns.tsx                # 그리드 컬럼 + 액션 셀 정의
├── types.ts                       # Part 인터페이스
├── iqc-aql-guard-demo.md          # IQC/AQL 정책 데모 설명
├── part-iqc-aql-guard.structure.test.mjs   # IQC 설정 구조 테스트
├── part-label-terms.structure.test.mjs     # 라벨 용어 구조 테스트
├── components/
│   ├── PartFormPanel.tsx          # 등록/수정 슬라이드 패널
│   ├── PartFormModal.tsx          # 확인·선택 모달
│   └── PartFieldHelp.tsx          # 필드별 DB 컬럼명
└── hooks/
    └── usePartFieldHelp.ts        # PartFieldHelp 컨텐츠 로딩 훅
```

---

## ② DB 테이블 및 필드 매핑

### 주 테이블: `ITEM_MASTERS`

| 화면 필드 | DB 컬럼 | 타입 | 비고 |
|-----------|---------|------|------|
| 품목코드 | ITEM_CODE | VARCHAR2(10) | PK, 등록 후 변경 불가 |
| 품번 | ITEM_NO | VARCHAR2(50) | NOT NULL. ERP sync 시 PK로 사용 |
| 품목명 | ITEM_NAME | VARCHAR2(200) | NOT NULL |
| 고객품번 | CUST_PART_NO | VARCHAR2(50) | |
| 리비전 | REV | VARCHAR2(10) | |
| 마킹문구 | MARKING_TEXT | VARCHAR2(100) | |
| 품목유형 | ITEM_TYPE | VARCHAR2(100) | 공통코드 ITEM_TYPE |
| 품목그룹 | PRODUCT_TYPE | VARCHAR2(100) | 공통코드 PRODUCT_TYPE |
| 차종 | MODEL_NAME | VARCHAR2(100) | |
| 모델구분 | DEFECT_MODEL_GROUP | VARCHAR2(100) | 공통코드 DEFECT_MODEL_GROUP |
| 규격 | SPEC | VARCHAR2(100) | |
| 색상 | COLOR | VARCHAR2(50) | |
| 단위 | UNIT | VARCHAR2(50) | 공통코드 UNIT_TYPE, 기본값 EA |
| IQC대상 | IQC_YN | CHAR(1) | Y/N (DB: 'Y'/'N') |
| 검사구분 | INSPECT_METHOD | VARCHAR2(50) | FULL/SKIP. 공통코드 IQC_INSPECT_METHOD |
| 기본시료수 | SAMPLE_QTY | NUMBER(12,2) | |
| AQL 정책 | IQC_AQL_POLICY_CODE | VARCHAR2(100) | IQC_AQL_POLICIES 참조 |
| 사용여부 | USE_YN | CHAR(1) | Y/N (DB: 'Y'/'N') |
| 박스장입수량 | BOX_QTY | NUMBER(12,4) | |
| 최소불출단위수량 | MIN_PACK_QTY | NUMBER(12,4) | |
| 묶음단위수량 | LOT_UNIT_QTY | NUMBER(12,4) | |
| 안전재고 | SAFETY_STOCK | NUMBER(12,4) | |
| 유효기간 | EXPIRY_DATE | NUMBER(12,0) | 입고/제조 기준 유효기간 일수 |
| 연장기간 | EXPIRY_EXT_DAYS | NUMBER(12,0) | 유효기간 연장 최대 일수 |
| 팔레트구성단위 | PACK_UNIT | NUMBER(12,4) | 팔레트당 박스 수 |
| 품목고정 적재로케이션 | STORAGE_LOCATION | VARCHAR2(100) | LOCATIONS 참조 |
| 비고 | REMARK | CLOB | |
| 사진 경로 | IMAGE_URL | VARCHAR2(500) | |
| 등록자 | CREATED_BY | VARCHAR2(50) | 시스템('ERP-IF', 'SYSTEM') 또는 사용자ID |
| 등록일시 | CREATED_AT | TIMESTAMP | |
| 수정자 | UPDATED_BY | VARCHAR2(50) | |
| 수정일시 | UPDATED_AT | TIMESTAMP | |

### 참조 테이블

| 테이블 | 용도 | 연결 조건 |
|--------|------|----------|
| IQC_AQL_POLICIES | AQL 정책 마스터 | ITEM_MASTERS.IQC_AQL_POLICY_CODE |
| ITEM_SPECIFICATIONS | 품목별 IQC 검사항목 | ITEM_CODE |
| LOCATIONS | 창고/로케이션 | ITEM_MASTERS.STORAGE_LOCATION |

---

## ③ API 엔드포인트

### 품목 CRUD

| HTTP | 경로 | 역할 | Request Body / Param | 주요 로직 |
|------|------|------|----------------------|----------|
| GET | /master/parts | 목록 조회 | query: itemCode, itemNo, itemName, itemType, useYn, iqcYn, inspectMethod, iqcAqlPolicyCode, page, limit | 페이징 + 필터. ITEM_MASTERS 전체 필드 반환 |
| POST | /master/parts | 등록 | Body: PartCreateDto | ITEM_CODE 채번? PK 중복 체크 |
| PUT | /master/parts/:id | 수정 | Body: PartUpdateDto | ITEM_CODE는 변경 불가 |
| DELETE | /master/parts/:id | 삭제 | params: id | 참조 무결성 체크(BOM 등); 삭제 가능? 아니면 USE_YN=N? |

### 이미지 업로드

| HTTP | 경로 | 역할 |
|------|------|------|
| POST | /master/parts/:id/image | 사진 업로드 (multipart) |
| DELETE | /master/parts/:id/image | 사진 삭제 |

### ERP 동기화

| HTTP | 경로 | 역할 |
|------|------|------|
| POST | /interface/inbound/item-master | ERP 품목 Bulk Insert (CREATED_BY='ERP-IF') |

### 참조 데이터

| HTTP | 경로 | 역할 |
|------|------|------|
| GET | /material/warehouses/locations | 적재 로케이션 목록 |
| GET | /quality/aql/policies | AQL 정책 목록 (팝업 선택) |
| GET | /comcode?codeGroup=ITEM_TYPE | 품목유형 코드 |
| GET | /comcode?codeGroup=PRODUCT_TYPE | 품목그룹 코드 |
| GET | /comcode?codeGroup=DEFECT_MODEL_GROUP | 모델구분 코드 |
| GET | /comcode?codeGroup=UNIT_TYPE | 단위 코드 |
| GET | /comcode?codeGroup=IQC_INSPECT_METHOD | 검사구분 코드 |

---

## ④ 상태 전이 / 검증 규칙

### 저장 시 검증
1. **필수 필드**: itemCode, itemNo, itemName, productType — 누락 시 저장 버튼 비활성화
2. **AQL 정책 필수 조건**: `iqcYn === 'Y' && inspectMethod === 'FULL'` → `iqcAqlPolicyCode` 필수 (`requiresIqcAqlPolicy` from `@harness/shared`)
3. **품목코드 불변**: 등록 시에만 입력, 수정 시 비활성화
4. **사진**: 저장과 별도 API — POST /master/parts/:id/image

### 사용 상태 (USE_YN)
- **Y (사용)**: 일반 조회 대상, IQC·생산·자재에서 품목 선택 가능
- **N (미사용)**: 목록에서 빨간색 행 표시, 조회 시 필터에서 제외 가능

### IQC 설정
```
IQC_YN = 'Y' ──▶ INSPECT_METHOD ── FULL ──▶ IQC_AQL_POLICY_CODE 필수
                  ├─ SKIP ──▶ 무검사 품목
                  └─ (공백) ──▶ 검사구분 미설정
IQC_YN = 'N' ──▶ IQC 미대상, AQL 정책 불필요
```

### ERP 동기화
- `POST /interface/inbound/item-master` — ERP에서 Bulk Insert
- etc_time_deco ERP에서 ITEM_MASTERS로 매핑 (columns: ITEM_CODE, ITEM_NO, ITEM_NAME, ...)
- `CREATED_BY = 'ERP-IF'` 플래그 기록
- 등록 후 목록 refresh

### 이미지 처리
- 업로드: POST multipart → 서버 Side-A 저장 → imageUrl 필드 갱신
- 삭제: 확인 모달 → DELETE → imageUrl null 처리
- 목록 썸네일: `next/image` (Image 태그 사용)

---

## ⑤ 그리드/목록 동작 상세

### 데이터그리드 설정 (`MuiDataGrid` / `DataGridCore`)

| 기능 | 값 | 비고 |
|------|-----|------|
| columnFilter | enable | 각 컬럼 헤더 필터 |
| export | enable | 엑셀 다운로드 |
| columnPinning | enable | 컬럼 고정 |
| row per page | 20/50/100/200 | |
| row selection | enable | |

### 액션 셀 (`partColumns.tsx`)
- **열린 패널 중 다른 행 클릭**: `useUnsavedGuard` → 변경사항이 있으면 확인 모달
- **패널 닫힌 상태 행 클릭**: 해당 품목 수정 패널 열림
- **더블클릭**: 수정 패널 열림

---

## ⑥ 정책 / 보안 / 감사

### 데이터 보안
- **품목 삭제**: DELETE API 시 BOM·생산오더·재고·IQC 이력 참조 확인
- **사용자는 USE_YN=N 품목을 목록에서 제외 가능** (필터)
- ERP 동기화는 INTERFACE 경로로만 가능

### 감사 추적
- CREATED_BY/CREATED_AT/UPDATED_BY/UPDATED_AT 모든 변경 이력 추적
- ERP-IF 일괄 등록 건은 CREATED_BY='ERP-IF'로 식별
- 이미지 업로드/삭제도 별도 감사 가능

### 스키마 변경 주의사항
- ITEM_MASTERS는 BOM·생산·자재·IQC 등 메인 업무 테이블의 FK 참조 대상
- ITEM_CODE 컬럼 타입/길이 변경 시 모든 참조 테이블 연쇄 영향 분석 필수
- STATUS 컬럼은 없음 — 활성/비활성은 USE_YN으로 처리. 삭제는 실제 DELETE.

---

## ⑦ 유지보수 시 확인 사항

1. **컬럼 추가 시**: PartFieldHelp.tsx DB 매핑, Part 인터페이스(types.ts), PartFormPanel 필드, partColumns.tsx, i18n ko.json, DTO, Service 로직, AlldatatypeCompanyHandler.repository 전 영역 반영
2. **AQL 정책 필수 규칙 변경 시**: `@harness/shared`의 `requiresIqcAqlPolicy` 수정 (프론트+백엔드 공유)
3. **ERP 인터페이스 변경 시**: `POST /interface/inbound/item-master` — InterfaceController의 매핑 로직 확인
4. **이미지 스토리지 변경 시**: POST/DELETE /master/parts/:id/image — 파일 저장 경로 확인
5. **스키마 변경 시**: `tools/generate_db_schema_doc.py`로 ERD 재생성
