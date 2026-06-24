---
menuCode: MST_VENDOR_BARCODE
audience: operator
title: 제조사 바코드 매핑 — 운영 가이드
summary: 제조사 바코드 매핑 전체 컬럼의 DB 매핑(VENDOR_BARCODE_MAPPINGS), 입고 스캔 매칭 로직(EXACT/PREFIX/REGEX), API·연계, 권한, 트러블슈팅
tags: [기준정보, 바코드, 매핑, 운영, 입고]
keywords: [VENDOR_BARCODE_MAPPINGS, VENDOR_BARCODE, ITEM_CODE, MATCH_TYPE, EXACT, PREFIX, REGEX, resolve, 바코드 변환, 입고 스캔, arrival, 자연키, 멀티테넌시, COMPANY, PLANT_CD]
related: [MST_PART]
---

# 제조사 바코드 매핑 — 운영 가이드

## 시스템 목적·역할
제조사(거래처)가 부착한 바코드 문자열을 자사 MES 품목으로 변환하기 위한 규칙 테이블 **`VENDOR_BARCODE_MAPPINGS`** 관리 화면입니다. 자재 **입고(arrival)** 처리 시 스캔한 바코드를 `ITEM_CODE`로 해석(resolve)하는 기준이 됩니다. 품번을 직접 식별하지 못하는 바코드를 매핑 규칙으로 보완합니다.

## 데이터 구조
```
VENDOR_BARCODE_MAPPINGS (PK: VENDOR_BARCODE  — 자연키)
   ├─ ITEM_CODE   ──▶ ITEM_MASTERS.ITEM_CODE   (변환 결과 품번)
   ├─ VENDOR_CODE ──▶ PARTNER/VENDOR_MASTERS    (발행 제조사)
   └─ MATCH_TYPE  : EXACT / PREFIX / REGEX       (매칭 방식)
   인덱스: (ITEM_CODE), (VENDOR_CODE)
   소비처: 자재 입고(arrival.service) 바코드 → 품목 resolve
```

## ① 매핑 — VENDOR_BARCODE_MAPPINGS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 제조사 바코드 | `VENDOR_BARCODE` | **PK(자연키, length 200)**. 스캔 원본 값. PREFIX면 접두 문자열, REGEX면 정규식 패턴을 이 컬럼에 저장. 중복 등록 시 409 Conflict. |
| 품번 | `ITEM_CODE` | 변환 결과가 되는 MES 품목코드(`ITEM_MASTERS.ITEM_CODE` 참조). 생성 시 필수. 인덱스 존재. |
| 품명 | `ITEM_NAME` | 조회 편의용 품명(nullable). |
| 제조사코드 | `VENDOR_CODE` | 발행 제조사 코드(거래처 마스터 참조, nullable). 인덱스 존재. 목록 필터/조회 조건으로 사용. |
| 제조사명 | `VENDOR_NAME` | 조회 편의용 제조사명(nullable). |
| 매핑규칙 | `MAPPING_RULE` | 규칙 설명 메모(nullable). 매칭 동작에는 비반영(참고용). |
| 매칭유형 | `MATCH_TYPE` | `EXACT`(정확 일치)/`PREFIX`(접두사 startsWith)/`REGEX`(정규식 test). 기본값 `EXACT`. resolve 시도 순서를 결정. |
| 비고 | `REMARK` | 관리 메모(nullable, length 500). |
| 사용여부 | `USE_YN` | `Y`만 resolve 매칭·조회 대상. 기본값 `Y`. `N`이면 매칭에서 제외. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. `CREATED_AT`/`UPDATED_AT`은 `@CreateDateColumn`/`@UpdateDateColumn`(DEFAULT SYSTIMESTAMP). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. 모든 조회·생성·수정·삭제·resolve에 테넌트 조건 포함. |

## 바코드 매칭(resolve) 로직
입고 스캔 등에서 `POST /master/vendor-barcode-mappings/resolve`가 호출되면, 테넌트 스코프 + `USE_YN='Y'` 내에서 다음 순서로 매칭한다.

1. **EXACT**: `VENDOR_BARCODE = 스캔값` 단건 조회 → 매칭 시 즉시 반환(`matchMethod: 'EXACT'`).
2. **PREFIX**: `MATCH_TYPE='PREFIX'` 행을 로드해 `스캔값.startsWith(VENDOR_BARCODE)` 비교 → 첫 매칭 반환.
3. **REGEX**: `MATCH_TYPE='REGEX'` 행을 로드해 `new RegExp(VENDOR_BARCODE).test(스캔값)` → 첫 매칭 반환. **잘못된 정규식 패턴은 무시(warn 로깅)**.
4. 모두 실패 시 `{ matched: false, mapping: null, matchMethod: null }`.

> 자재 입고(`arrival.service`)는 바코드로 품목을 직접 못 찾을 때 2차로 이 매핑(`ITEM_CODE`)을 조회해 품목을 해석한다.

## API
| 메서드 | 경로 | 설명 |
|------|------|------|
| GET | `/master/vendor-barcode-mappings` | 목록(page/limit/search/vendorCode/useYn, `VENDOR_BARCODE ASC`) |
| GET | `/master/vendor-barcode-mappings/:vendorBarcode` | 상세 |
| POST | `/master/vendor-barcode-mappings` | 생성(중복 시 409) |
| PUT | `/master/vendor-barcode-mappings/:vendorBarcode` | 수정 |
| DELETE | `/master/vendor-barcode-mappings/:vendorBarcode` | 삭제(물리 삭제) |
| POST | `/master/vendor-barcode-mappings/resolve` | 바코드 → 품목 매칭 |

## 사전 설정 (마스터·공통코드)
- **품목마스터([품목마스터])**: 매핑할 `ITEM_CODE`가 `ITEM_MASTERS`에 선행 등록되어 있어야 한다.
- **거래처/제조사 마스터**: `VENDOR_CODE`/`VENDOR_NAME`의 출처(제조사 관리). 제조사는 `PARTNER_MASTERS.partnerType='MFG'`로 통합 관리.

## 운영 절차
1. 입고 시 자동 인식되지 않는 제조사 바코드를 파악한다.
2. 동일 품목에 바코드가 고정 → **EXACT**, 끝자리만 바뀜 → 공통 접두사로 **PREFIX**, 패턴 식별 → **REGEX**로 등록한다.
3. `ITEM_CODE`(필수)를 정확히 연결하고 `USE_YN='Y'`로 활성화한다.
4. `resolve`로 실제 스캔값이 의도한 품번으로 변환되는지 검증한다.

## 권한
기준정보 관리자(등록/수정/삭제). 일반 사용자·키오스크는 조회 및 입고 스캔 시 resolve 사용.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 입고 스캔에서 변환 안 됨 | `USE_YN='N'` 또는 값/유형 불일치 | 사용여부 Y 확인, EXACT는 값 완전일치 여부 점검 |
| PREFIX가 안 잡힘 | 접두 문자열이 스캔값 시작과 다름 | `VENDOR_BARCODE`를 실제 공통 접두사로 수정 |
| REGEX가 안 잡힘 | 정규식 패턴 오류(무시됨) | 백엔드 warn 로그 확인, 패턴 교정 |
| 저장 시 중복 오류(409) | 동일 `VENDOR_BARCODE` 존재 | 기존 행 수정 또는 다른 키 사용 |
| 여러 PREFIX/REGEX가 겹쳐 의도와 다른 품목 매칭 | 첫 매칭 반환 특성 | 겹치는 규칙 정리, 더 좁은 접두사/패턴으로 등록 |
| 변환 결과 품번이 품목마스터에 없음 | `ITEM_CODE` 오타/미등록 | 품목마스터에서 코드 확인 후 수정 |

## 데이터·연계
- 테이블: `VENDOR_BARCODE_MAPPINGS`(PK `VENDOR_BARCODE` 자연키)
- 연계: 품목마스터(`ITEM_MASTERS.ITEM_CODE`), 거래처/제조사 마스터(`VENDOR_CODE`), 자재 입고(arrival resolve)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
