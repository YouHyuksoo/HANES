# 양불마스터(한도견본) 전용 기준정보 설계

- 작성일: 2026-09-16
- 상태: 승인 (구현 대기)
- 관련 화면: `/master/limit-sample` (신규), `/master/inspect-aid` (축소)

## 1. 배경과 문제

`INSPECT_AIDS`(검사보조구 마스터)는 `AID_TYPE`으로 세 가지를 한 테이블에 담고 있다.

| AID_TYPE | 의미 | 실데이터(JSHANES, 2026-09-16 실측) |
|---|---|---|
| LIMIT_OK | 양품 한도견본 | 38건 |
| LIMIT_NG | 불량 한도견본 | 38건 |
| HOLDER | 검사홀더·지그 | **0건** |

`INSPECT_SAMPLE_CHECK_ITEMS`(대조 실적) = **0건**.

즉 "검사보조구 마스터"는 실제로는 100% 양불마스터로 쓰이고 있고, 본래 용도인
홀더·지그는 한 건도 없다. 성격이 다른 두 기준정보(대조 판정용 견본 vs 검사 치공구)가
한 테이블·한 화면에 섞여 있어 유형 탭으로 갈라 보는 구조였다.

대조 실적이 0건이라 이력 호환 부담 없이 지금 분리할 수 있다.

## 2. 결정

양불마스터를 **신규 테이블 + 전용 화면**으로 분리하고, `INSPECT_AIDS`는
홀더·지그 전용으로 좁힌다. 기존 76건은 신규 테이블로 이관한다.

사진은 한도견본 1건당 여러 장(각도별·불량유형별)이 필요하므로 자식 테이블로 뽑는다.

## 3. 신규 스키마

### 3.1 LIMIT_SAMPLES (양불마스터)

PK = `COMPANY` + `PLANT_CD` + `SAMPLE_CODE` (INSPECT_AIDS와 같은 복합 PK 패턴)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| COMPANY | VARCHAR2(50) NOT NULL | 회사 코드 |
| PLANT_CD | VARCHAR2(50) NOT NULL | 사업장 코드 |
| SAMPLE_CODE | VARCHAR2(50) NOT NULL | 견본 코드 (사용자 입력, 바코드 스캔값) |
| SAMPLE_TYPE | VARCHAR2(30) NOT NULL | OK=양품견본 / NG=불량견본 (COM_CODES LIMIT_SAMPLE_TYPE) |
| SAMPLE_NAME | VARCHAR2(200) NOT NULL | 견본 명칭 |
| ITEM_CODE | VARCHAR2(50) | 대상 품목 (NULL=공용) |
| PROCESS_CODE | VARCHAR2(50) | 적용 공정 |
| DEFECT_CODE | VARCHAR2(50) | 불량견본의 대표 불량코드 |
| INSPECT_TYPE | VARCHAR2(30) | 적용 검사유형 (NULL=전 검사유형 공통) |
| LOCATION | VARCHAR2(200) | 보관 위치 |
| VALID_FROM / VALID_TO | DATE | 유효기간 (VALID_TO가 만료·임박 판정 기준) |
| APPROVED_BY | VARCHAR2(50) | 승인자 |
| APPROVED_AT | TIMESTAMP | 승인일시 |
| STATUS | VARCHAR2(20) DEFAULT 'ACTIVE' NOT NULL | ACTIVE / EXPIRED / RETIRED |
| REQUIRED_YN | CHAR(1) DEFAULT 'Y' NOT NULL | 검사 전 대조 필수 여부 |
| SORT_ORDER | NUMBER DEFAULT 0 NOT NULL | 대조 모달 표시 순서 |
| REMARK | VARCHAR2(500) | 비고 |
| USE_YN | CHAR(1) DEFAULT 'Y' NOT NULL | 사용여부 |
| CREATED_BY / UPDATED_BY | VARCHAR2(50) | 감사 |
| CREATED_AT / UPDATED_AT | TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL | 감사 |

제약: `CK_LIMIT_SAMPLES_TYPE CHECK (SAMPLE_TYPE IN ('OK','NG'))`,
`CK_LIMIT_SAMPLES_STATUS`, `CK_LIMIT_SAMPLES_USE_YN`, `CK_LIMIT_SAMPLES_REQ_YN`.

인덱스:
- `IX_LIMIT_SAMPLES_LOOKUP (COMPANY, PLANT_CD, ITEM_CODE, INSPECT_TYPE, SAMPLE_TYPE)` — 대조 후보 조회(`getCandidates`)가 이 조합으로 읽는다.
- `IX_LIMIT_SAMPLES_VALID (COMPANY, PLANT_CD, VALID_TO)` — 만료·임박 조회용.

**`IMAGE_URL`은 부모에 두지 않는다.** 사진은 전부 자식 테이블이 단일출처다.

### 3.2 LIMIT_SAMPLE_IMAGES (견본 사진)

PK = `COMPANY` + `PLANT_CD` + `SAMPLE_CODE` + `SEQ_NO`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| SEQ_NO | NUMBER NOT NULL | 사진 순번 |
| IMAGE_URL | VARCHAR2(500) NOT NULL | 파일 경로 (/uploads/limit-samples/...) |
| CAPTION | VARCHAR2(200) | 사진 설명 (각도, 불량 부위 등) |
| IS_PRIMARY | CHAR(1) DEFAULT 'N' NOT NULL | 대표 사진 (견본당 최대 1건) |
| SORT_ORDER | NUMBER DEFAULT 0 NOT NULL | 표시 순서 |
| CREATED_BY / CREATED_AT | | 감사 |

대표 사진을 자식에 `IS_PRIMARY`로 두는 이유: 그리드 썸네일과 대조 모달
썸네일(`InspectItemImage` 44px)이 둘 다 **1장**만 필요하다. 부모에 `IMAGE_URL`을
남겨 두면 대표 사진이 두 곳에 기록돼 어긋날 수 있다.

유니크: 함수기반 유니크 인덱스 `UX_LIMIT_SAMPLE_IMAGES_PRIMARY`를
`CASE WHEN IS_PRIMARY = 'Y' THEN COMPANY || '|' || PLANT_CD || '|' || SAMPLE_CODE END`
에 걸어 견본당 대표 1장을 DB가 강제한다.

부모 삭제 시 자식 행 + 업로드 파일을 함께 정리한다(기존 inspect-aid `delete`가
`imageUrl`을 반환해 파일을 지우던 계약을 `imageUrls[]` 반환으로 확장).

### 3.3 공통코드

| GROUP_CODE | DETAIL_CODE | CODE_NAME | ATTR1(배지) |
|---|---|---|---|
| LIMIT_SAMPLE_TYPE | OK | 양품견본 | bg-green-600 text-white |
| LIMIT_SAMPLE_TYPE | NG | 불량견본 | bg-red-600 text-white |
| LIMIT_SAMPLE_STATUS | ACTIVE | 사용중 | bg-green-600 text-white |
| LIMIT_SAMPLE_STATUS | EXPIRED | 만료 | bg-red-600 text-white |
| LIMIT_SAMPLE_STATUS | RETIRED | 폐기 | bg-gray-600 text-white |

한글 라벨은 i18n `comCode.LIMIT_SAMPLE_TYPE.OK` 형식 단일출처를 따르고,
배지는 공통 `StatusBadge` / `ComCodeBadge`를 쓴다.

## 4. 데이터 이관과 INSPECT_AIDS 축소

### 4.1 이관 (76건)

```sql
INSERT INTO LIMIT_SAMPLES (
  COMPANY, PLANT_CD, SAMPLE_CODE, SAMPLE_TYPE, SAMPLE_NAME,
  ITEM_CODE, PROCESS_CODE, DEFECT_CODE, INSPECT_TYPE, LOCATION,
  VALID_FROM, VALID_TO, APPROVED_BY, APPROVED_AT, STATUS,
  REQUIRED_YN, SORT_ORDER, REMARK, USE_YN,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
)
SELECT COMPANY, PLANT_CD, AID_CODE,
       CASE AID_TYPE WHEN 'LIMIT_OK' THEN 'OK' ELSE 'NG' END,
       AID_NAME, ITEM_CODE, PROCESS_CODE, DEFECT_CODE, INSPECT_TYPE, LOCATION,
       VALID_FROM, VALID_TO, APPROVED_BY, APPROVED_AT, STATUS,
       REQUIRED_YN, SORT_ORDER, REMARK, USE_YN,
       CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
  FROM INSPECT_AIDS
 WHERE AID_TYPE IN ('LIMIT_OK', 'LIMIT_NG');
```

IMAGE_URL은 현재 76건 전부 NULL이므로 파일·자식행 이관이 없다.
건수 대조(pre 76 / post 76) 확인 후
`DELETE FROM INSPECT_AIDS WHERE AID_TYPE IN ('LIMIT_OK','LIMIT_NG')`.

### 4.2 INSPECT_AIDS 축소

- 컬럼 DROP: `DEFECT_CODE`, `INSPECT_TYPE`, `REQUIRED_YN`, `SORT_ORDER`
  — 전부 한도견본 대조 전용 속성이고, 이관 후 전량 NULL/무의미가 된다.
- `COM_CODES INSPECT_AID_TYPE`의 `LIMIT_OK` / `LIMIT_NG` → `USE_YN = 'N'`.
- **HOLDER 시드 데이터 투입** — 이관 후 화면이 0건이 되어 메뉴가 비는 것을 막는다.
  검사홀더·지그 실물 기준으로 초기 행을 등록한다.
- 화면: 유형 탭(전체/양품견본/불량견본/홀더) 제거 → 단일 유형 마스터.
  DROP한 4개 필드의 입력·컬럼 제거.
- 서비스: `create`/`update`의 `aidType === 'HOLDER' ? 'N'` 분기 제거,
  `InspectAidQueryDto.inspectType` 필터 제거.
- 문구: "검사보조구(한도견본·검사홀더)" → "검사보조구(검사홀더·지그)"로 전 파일 정정
  (엔티티/서비스/컨트롤러 docstring, ApiTags, i18n 4파일).

`AID_TYPE` 컬럼과 `IX_INSPECT_AIDS_TYPE`은 유지한다 — 향후 홀더 외 보조구 유형이
늘어날 수 있고, CHECK 제약으로 도메인을 굳히면 확장이 막힌다. 도메인 제한은
공통코드로만 한다.

## 5. 대조 플로우 전환

`INSPECT_SAMPLE_CHECK_ITEMS`의 `AID_CODE` / `AID_TYPE` →
**`SAMPLE_CODE` / `SAMPLE_TYPE`으로 리네임**한다. 실적 0건이라 지금이 마지막 기회이며,
안 바꾸면 양불마스터를 참조하는 컬럼이 영구히 "aid"라는 틀린 이름을 달고 다음 세션이
inspect-aid를 조인하려 들게 된다. RENAME COLUMN 후 타입은 그대로 VARCHAR2다
(과거 `_ID → _CODE` 리네임에서 NUMBER 타입이 남아 ORA-01722 위험을 만든 것과 달리
타입 변경이 없다).

`EXPECTED_RESULT` 매핑을 새 도메인으로 다시 쓴다: `OK → PASS`, `NG → FAIL`.

전환 대상 파일:

| 파일 | 변경 |
|---|---|
| `inspect-sample-check.service.ts` | `SAMPLE_AID_TYPES` → `['OK','NG']`, `aidRepository` → `limitSampleRepository`, `toCandidate`(대표 사진 1장 조회), `getCandidates` where 조합 |
| `continuity-inspect.module.ts` | `forFeature([InspectAid])` → `[LimitSample, LimitSampleImage]` |
| `inspect-sample-check.service.spec.ts` | `getRepositoryToken(InspectAid)` 모킹 교체 — **이 spec이 깨지지 않으면 분리가 안 된 것** |
| `inspect-sample-check-item.entity.ts` | 컬럼명 + docstring |
| `SampleCheckModal.tsx` | `SampleCheckCandidate`의 `aidCode`/`aidName`/`aidType` → `sampleCode`/`sampleName`/`sampleType` |

`SampleCheckCandidate.imageUrl`은 **단일값을 유지**한다(대표 1장). 대조 모달은
44px 썸네일 1장만 쓰므로 다중 사진을 내려보낼 이유가 없다.

## 6. 신규 화면 `/master/limit-sample`

- 메뉴코드 `QC_LIMIT_SAMPLE`, 라벨 **"양불마스터"**, 카테고리 QUALITY.
- 좌: `DataGrid` 서버 페이징 + 대표 사진 썸네일 + 유형/상태 배지 + 만료·임박 배지.
- 상단: 만료·임박 요약(D-30, `GET /expiring`) — inspect-aid에서 이쪽으로 이동.
- 필터: 검색어, 유형(OK/NG), 상태, 품목, 공정, 검사유형, 사용여부.
  목록 기본 필터는 `useYn = 'Y'` (조건 없는 전량 조회 금지 규칙).
- 우: 슬라이드 폼 패널 — **액션 버튼 상단**, 행 클릭 시 key 재마운트 대신 데이터 교체,
  `useUnsavedGuard`로 작성중 유실 방어. `InspectAidFormPanel` 패턴을 따른다.
- 사진 섹션(신규): 여러 장 업로드, 각 장 캡션 입력, 대표 지정(라디오), 순서 변경, 개별 삭제.
- 코드성 값은 `ComCodeSelect` / 기준정보 선택 컴포넌트를 쓴다.

### API (`/master/limit-samples`)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/` | 목록 (페이징·필터) |
| GET | `/expiring?days=30` | 만료·임박 |
| GET | `/:code` | 상세 (사진 목록 포함) |
| POST | `/` | 생성 |
| PUT | `/:code` | 수정 |
| DELETE | `/:code` | 삭제 (사진 행 + 파일 정리) |
| POST | `/:code/images` | 사진 추가 (multer, `uploads/limit-samples`) |
| PUT | `/:code/images/:seqNo` | 캡션·대표·순서 수정 |
| DELETE | `/:code/images/:seqNo` | 사진 삭제 (파일 포함) |

## 7. 배선 체크리스트

- 메뉴 4곳 동시: `apps/frontend/src/config/menuConfig.ts`,
  `apps/backend/src/seeds/menu-config.json`,
  `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`,
  DB MERGE(`MENU_CATEGORY_ITEMS` + `ROLE_MENU_PERMISSIONS`).
- i18n 4파일 동시: `ko/en/zh/vi.json` — `master.limitSample.*`,
  `comCode.LIMIT_SAMPLE_TYPE.*`, `comCode.LIMIT_SAMPLE_STATUS.*`. **UTF-8 BOM 금지.**
- page registry: `components/layout/page-registries/master__limit-sample.generated.ts` +
  `pageRegistry.generated.ts` 등록.
- 엔티티 배럴 `apps/backend/src/entities/index.ts` export 추가.
- `docs/database/table-catalog.md`에 신규 테이블 2개의 설명·동의어("양불마스터", "한도견본")·
  JOIN키 추가 (text-to-SQL 프롬프트 주입 대상).
- DDL/DML 적용 후 `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`로 ERD 갱신.

## 8. 검증

- 백엔드: `inspect-sample-check.service.spec.ts` 갱신 + 통과,
  신규 `limit-sample.service.spec.ts`(대표 사진 유일성, 이관 매핑, 만료 판정).
- 프론트: `limit-sample.structure.test.mjs`(기존 `inspect-aid.structure.test.mjs` 패턴)
  — 액션 버튼 상단 배치, `useUnsavedGuard` 사용, `alert`/`confirm` 미사용, i18n 키 존재.
- `pnpm.cmd run typecheck:frontend` / `pnpm.cmd run typecheck:backend`.
- DB: 이관 pre/post 건수 대조, DROP 전후 스키마 조회 기록.

## 9. 범위 밖

- 견본 개정(Rev) 이력·승인 리비전 관리 — 이번에 넣지 않는다(현재 컬럼으로 충분하다는 확인).
- 양품/불량 견본의 SET(세트) 묶음 관리 — 현행대로 OK/NG 각각 1행.
