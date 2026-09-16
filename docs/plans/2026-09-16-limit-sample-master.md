# 양불마스터(한도견본) 전용 기준정보 구현 계획

> **For agentic workers:** 이 계획은 task 단위로 실행한다. 각 task는 독립 검증 가능한 산출물로 끝난다.

**Goal:** `INSPECT_AIDS`에 섞여 있던 양품/불량 한도견본 76건을 신규 `LIMIT_SAMPLES`(+`LIMIT_SAMPLE_IMAGES`) 테이블과 전용 화면 `/master/limit-sample`로 분리하고, `inspect-aid`를 검사홀더·지그 전용으로 좁힌다.

**Architecture:** Oracle 신규 테이블 2개(부모/사진 자식) + NestJS master 모듈 CRUD + Next.js 기준정보 화면(좌 DataGrid / 우 슬라이드 패널). 대조 플로우(`continuity-inspect`)의 참조 대상을 `InspectAid` → `LimitSample`로 전환한다.

**Tech Stack:** Oracle(JSHANES, company=40/plant=1000), NestJS + TypeORM, Next.js 15 App Router, react-i18next, TanStack Table

**Spec:** `docs/specs/2026-09-16-limit-sample-master-design.md`

## Global Constraints

- 패키지 매니저는 `pnpm`. typecheck는 `pnpm.cmd run typecheck:frontend` / `typecheck:backend`.
- DDL/DML은 SQL 파일만 만들고 끝내지 않는다. `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <file>`로 실제 적용하고 pre/post 쿼리 결과를 기록한다.
- Oracle 감사 컬럼은 `DEFAULT SYSTIMESTAMP` 필수. TypeORM nullable union 컬럼(`string | null`)은 `@Column`에 `type` 명시 필수.
- 메뉴 등록은 4곳 동시: `apps/frontend/src/config/menuConfig.ts`, `apps/backend/src/seeds/menu-config.json`, `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`, DB MERGE(`MENU_CATEGORY_ITEMS` + `ROLE_MENU_PERMISSIONS`).
- i18n은 `ko/en/zh/vi` 4파일 동시 수정. **UTF-8 BOM 금지**.
- `alert()`/`confirm()`/`prompt()` 금지 — 공용 `ConfirmModal`/토스트.
- 코드성 값은 `ComCodeSelect`/`ComCodeBadge`/`StatusHeaderHelp` 사용. 배지에 파스텔 배경색 금지(텍스트/테두리 구분).
- 우측 폼 패널 액션 버튼은 **상단** 배치, 행 클릭 시 key 재마운트 금지(데이터 교체) + `useUnsavedGuard`.
- 목록 기본 필터는 `useYn='Y'` — 조건 없는 전량 조회 금지.
- `catch (error: unknown)` 유지, `as any` 금지. 멀티테넌시 `COMPANY`/`PLANT_CD` 스코프 포함.
- `git add`는 파일 단위. main에 직접 커밋. push는 사용자 지시 시에만.

**고정 이름 (task 간 계약):**

| 항목 | 값 |
|---|---|
| 테이블 | `LIMIT_SAMPLES`, `LIMIT_SAMPLE_IMAGES` |
| 엔티티 | `LimitSample` (`entities/limit-sample.entity.ts`), `LimitSampleImage` (`entities/limit-sample-image.entity.ts`) |
| 서비스/컨트롤러 | `LimitSampleService`, `LimitSampleController` (`modules/master/{services,controllers}/limit-sample.*`) |
| DTO | `CreateLimitSampleDto`, `UpdateLimitSampleDto`, `LimitSampleQueryDto`, `LimitSampleExpiringQueryDto`, `UpdateLimitSampleImageDto` |
| 상수 | `LIMIT_SAMPLE_TYPES = ['OK','NG']`, `LIMIT_SAMPLE_STATUSES = ['ACTIVE','EXPIRED','RETIRED']`, `LIMIT_SAMPLE_INSPECT_TYPES = ['CONTINUITY','TERMINAL']` |
| API prefix | `/master/limit-samples` |
| 업로드 경로 | `./uploads/limit-samples`, URL `/uploads/limit-samples/<file>` |
| 화면 | `/master/limit-sample`, 메뉴코드 `QC_LIMIT_SAMPLE`, labelKey `menu.master.limitSample` |
| i18n 네임스페이스 | `master.limitSample.*`, `comCode.LIMIT_SAMPLE_TYPE.*`, `comCode.LIMIT_SAMPLE_STATUS.*` |
| 뷰 타입 | `LimitSampleView`(서버) / `LimitSampleRow`(프론트) — `validFrom`/`validTo`는 `'YYYY-MM-DD'` 문자열, `expiryState`/`daysToExpiry` 포함, `images: LimitSampleImageView[]`, `primaryImageUrl: string \| null` |

---

### Task 1: DB — 신규 테이블·공통코드·메뉴 생성

**Files:**
- Create: `apps/backend/src/migrations/2026-09-16_limit_samples.sql`

**Interfaces:**
- Produces: `LIMIT_SAMPLES`, `LIMIT_SAMPLE_IMAGES` 테이블, `COM_CODES` 그룹 `LIMIT_SAMPLE_TYPE`/`LIMIT_SAMPLE_STATUS`, 메뉴 `QC_LIMIT_SAMPLE`

- [ ] **Step 1: pre 쿼리로 현황 기록**

`SELECT AID_TYPE, COUNT(*) FROM INSPECT_AIDS GROUP BY AID_TYPE` / `SELECT COUNT(*) FROM INSPECT_SAMPLE_CHECK_ITEMS`
기대: LIMIT_OK 38, LIMIT_NG 38, 대조 실적 0.

- [ ] **Step 2: 마이그레이션 SQL 작성**

`2026-09-09_inspect_aids.sql` 구조를 따른다(존재 확인 후 CREATE, 코드/메뉴는 MERGE, 블록은 `/` 라인 분리).
- `LIMIT_SAMPLES`: 스펙 3.1 컬럼 전부 + `CK_LIMIT_SAMPLES_TYPE/STATUS/USE_YN/REQ_YN` + `IX_LIMIT_SAMPLES_LOOKUP` + `IX_LIMIT_SAMPLES_VALID`
- `LIMIT_SAMPLE_IMAGES`: 스펙 3.2 + 함수기반 유니크 인덱스 `UX_LIMIT_SAMPLE_IMAGES_PRIMARY`
- 전 컬럼 한글 COMMENT
- `COM_CODES` MERGE 5건(TYPE OK/NG, STATUS ACTIVE/EXPIRED/RETIRED)
- `MENU_CATEGORY_ITEMS` + `ROLE_MENU_PERMISSIONS`(MANAGER/OPERATOR) MERGE — `QC_LIMIT_SAMPLE`, CATEGORY `QUALITY`, `QC_INSPECT_AID`(SORT_ORDER 6) 다음인 7

- [ ] **Step 3: 실제 적용**

```
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-09-16_limit_samples.sql
```

- [ ] **Step 4: post 검증**

`USER_TABLES`에서 두 테이블 존재, `USER_TAB_COLUMNS` 컬럼 수, `COM_CODES` 5건, `MENU_CATEGORY_ITEMS` 1건 확인.

- [ ] **Step 5: 커밋** — `feat(quality): 양불마스터 테이블과 공통코드·메뉴를 만든다`

---

### Task 2: DB — 76건 이관 · INSPECT_AIDS 축소 · HOLDER 시드

**Files:**
- Create: `apps/backend/src/migrations/2026-09-16_limit_samples_migrate.sql`

**Interfaces:**
- Consumes: Task 1의 `LIMIT_SAMPLES`
- Produces: `LIMIT_SAMPLES` 76행, `INSPECT_AIDS`는 HOLDER 시드만, 4개 컬럼 DROP 완료

- [ ] **Step 1: 이관 INSERT SELECT** — 스펙 4.1 SQL 그대로. `LIMIT_OK→OK`, `LIMIT_NG→NG`.

- [ ] **Step 2: 건수 대조** — `SELECT SAMPLE_TYPE, COUNT(*) FROM LIMIT_SAMPLES GROUP BY SAMPLE_TYPE` = OK 38 / NG 38.

- [ ] **Step 3: 원본 삭제** — `DELETE FROM INSPECT_AIDS WHERE AID_TYPE IN ('LIMIT_OK','LIMIT_NG')`.

- [ ] **Step 4: HOLDER 시드 투입**

`INSPECT_AIDS`에 검사홀더·지그 초기 행 MERGE(멱등). 최소 3건: 통전검사 홀더, 단자압착 검사지그, 외관검사 확대경 스탠드. `STATUS='ACTIVE'`, `USE_YN='Y'`, `VALID_FROM` 당일.

- [ ] **Step 5: 컬럼 DROP + 코드 비활성**

```sql
ALTER TABLE INSPECT_AIDS DROP (DEFECT_CODE, INSPECT_TYPE, REQUIRED_YN, SORT_ORDER);
UPDATE COM_CODES SET USE_YN='N' WHERE GROUP_CODE='INSPECT_AID_TYPE' AND DETAIL_CODE IN ('LIMIT_OK','LIMIT_NG');
```

DDL이 의존 PL/SQL 패키지를 INVALID로 만들 수 있으므로 적용 후 `ALTER PACKAGE ... COMPILE`이 필요한 대상이 있는지 `USER_OBJECTS`에서 확인한다.

- [ ] **Step 6: 실제 적용 + post 검증** — `USER_TAB_COLUMNS`에서 4개 컬럼 부재, `INSPECT_AIDS` 건수 = 시드 건수.

- [ ] **Step 7: 커밋** — `feat(quality): 한도견본 76건을 양불마스터로 이관하고 검사보조구를 홀더 전용으로 좁힌다`

---

### Task 3: DB — 대조 실적 컬럼 리네임

**Files:**
- Create: `apps/backend/src/migrations/2026-09-16_sample_check_rename.sql`

- [ ] **Step 1: 리네임 SQL**

```sql
ALTER TABLE INSPECT_SAMPLE_CHECK_ITEMS RENAME COLUMN AID_CODE TO SAMPLE_CODE;
ALTER TABLE INSPECT_SAMPLE_CHECK_ITEMS RENAME COLUMN AID_TYPE TO SAMPLE_TYPE;
```

컬럼 COMMENT도 새 도메인(OK/NG)으로 다시 작성한다. 타입은 VARCHAR2 그대로 — 변경하지 않는다.

- [ ] **Step 2: 적용 + post 검증** — `USER_TAB_COLUMNS`에서 `SAMPLE_CODE`/`SAMPLE_TYPE` 존재, `AID_*` 부재. 데이터 0건이라 값 변환 불필요.

- [ ] **Step 3: 커밋** — `refactor(quality): 대조 실적 컬럼을 양불마스터 이름에 맞춘다`

---

### Task 4: BE — 엔티티·DTO·서비스·컨트롤러 신설

**Files:**
- Create: `apps/backend/src/entities/limit-sample.entity.ts`, `limit-sample-image.entity.ts`
- Create: `apps/backend/src/modules/master/dto/limit-sample.dto.ts`
- Create: `apps/backend/src/modules/master/services/limit-sample.service.ts`
- Create: `apps/backend/src/modules/master/controllers/limit-sample.controller.ts`
- Create: `apps/backend/src/modules/master/services/limit-sample.service.spec.ts`
- Modify: `apps/backend/src/entities/index.ts`, `apps/backend/src/modules/master/master.module.ts`

**Interfaces:**
- Produces:
  - `LimitSampleService.toView(sample, images, expiringDays?) → LimitSampleView`
  - `findAll(query, company, plant) → { data, total, page, limit }`
  - `findExpiring(days, company, plant) → LimitSampleView[]`
  - `findByCode(sampleCode, company, plant) → LimitSample`
  - `findDetail(sampleCode, company, plant) → LimitSampleView`
  - `create/update(dto, company, plant, userId) → LimitSampleView`
  - `delete(sampleCode, company, plant) → { sampleCode, deleted: true, imageUrls: string[] }`
  - `addImage(sampleCode, imageUrl, company, plant, userId) → LimitSampleView`
  - `updateImageMeta(sampleCode, seqNo, dto, company, plant, userId) → LimitSampleView`
  - `removeImage(sampleCode, seqNo, company, plant) → { imageUrl: string \| null; view: LimitSampleView }`

- [ ] **Step 1: 실패 테스트 작성** (`limit-sample.service.spec.ts`)

3개 케이스를 먼저 쓴다.
1. `toView`가 `VALID_TO` 기준으로 `expiryState`를 `EXPIRED/EXPIRING/VALID/NONE`로 산출한다(inspect-aid.service의 판정 로직과 동일 규칙).
2. `addImage`가 첫 사진을 자동으로 `IS_PRIMARY='Y'`로 만들고, 두 번째 사진은 `'N'`으로 둔다.
3. `updateImageMeta`로 대표를 바꾸면 기존 대표가 `'N'`으로 내려간다(견본당 대표 1장).

- [ ] **Step 2: 실패 확인** — `pnpm.cmd --filter backend test -- limit-sample.service.spec` → 모듈 없음으로 FAIL.

- [ ] **Step 3: 엔티티 작성**

스펙 3.1/3.2 컬럼 그대로. nullable 컬럼은 전부 `@Column({ type: 'varchar2', ... })` 형태로 타입 명시. `@CreateDateColumn`/`@UpdateDateColumn`.

- [ ] **Step 4: DTO 작성**

`inspect-aid.dto.ts` 패턴 복제 + 이름만 교체. `CreateLimitSampleDto`는 `sampleCode/sampleType/sampleName/itemCode/processCode/defectCode/inspectType/location/validFrom/validTo/approvedBy/approvedAt/status/requiredYn/sortOrder/remark/useYn`. `UpdateLimitSampleImageDto`는 `caption?`, `isPrimary?('Y'|'N')`, `sortOrder?`.

- [ ] **Step 5: 서비스 구현**

`inspect-aid.service.ts`의 날짜 정규화(`toDateOnly`/`parseLocalDate`/`startOfToday`)와 `findAll` 필터·정렬을 그대로 가져오되:
- 목록은 부모 조회 후 해당 페이지의 `SAMPLE_CODE` 집합으로 사진을 **한 번에** 조회해 매핑한다(N+1 금지).
- `primaryImageUrl`은 `IS_PRIMARY='Y'` 1건, 없으면 `SORT_ORDER` 최소 1건.
- `addImage`: `SEQ_NO = MAX+1`, 기존 사진이 없으면 `IS_PRIMARY='Y'`.
- `updateImageMeta`: `isPrimary='Y'`면 같은 견본의 다른 행을 `'N'`으로 내린 뒤 대상만 `'Y'`.
- `delete`: 자식 행 삭제 + `imageUrls` 반환.

- [ ] **Step 6: 컨트롤러 구현**

`inspect-aid.controller.ts` 패턴. 라우트는 스펙 6절 표 그대로. `@Get('expiring')`은 `@Get(':code')`보다 위에 둔다(라우트 우선순위). multer `UPLOAD_DIR='./uploads/limit-samples'`, 파일명 `limit-sample-<ts>-<rand><ext>`, 이미지 MIME 화이트리스트, 5MB 제한. 파일 삭제 실패는 `catch (error: unknown)` + 경고 로깅만.

- [ ] **Step 7: 모듈 등록** — `master.module.ts`의 `forFeature` 배열 + `controllers` + `providers` + `exports`에 추가. `entities/index.ts`에 export 2줄 추가.

- [ ] **Step 8: 테스트 통과 + typecheck**

`pnpm.cmd --filter backend test -- limit-sample.service.spec` PASS, `pnpm.cmd run typecheck:backend` PASS.

- [ ] **Step 9: 커밋** — `feat(quality): 양불마스터 API를 추가한다`

---

### Task 5: BE — inspect-aid 축소

**Files:**
- Modify: `apps/backend/src/entities/inspect-aid.entity.ts`
- Modify: `apps/backend/src/modules/master/dto/inspect-aid.dto.ts`
- Modify: `apps/backend/src/modules/master/services/inspect-aid.service.ts`
- Modify: `apps/backend/src/modules/master/controllers/inspect-aid.controller.ts`
- Delete: `apps/backend/src/modules/master/services/inspect-aid-inspect-type.spec.ts`

- [ ] **Step 1: 엔티티에서 DROP한 4필드 제거** — `defectCode`, `inspectType`, `requiredYn`, `sortOrder`. docstring을 "검사홀더·지그"로 정정.

- [ ] **Step 2: DTO 정리** — `INSPECT_AID_TYPES = ['HOLDER']`, `INSPECT_AID_INSPECT_TYPES` 상수 제거, 해당 필드 제거.

- [ ] **Step 3: 서비스 정리** — `create`/`update`의 `aidType === 'HOLDER' ? 'N'` 분기와 4필드 매핑 제거, `findAll`의 `inspectType` 필터 제거, 정렬을 `aidCode` 단일로. NotFound 메시지·docstring 문구 정정.

- [ ] **Step 4: 컨트롤러 ApiTags/summary 문구 정정** — "검사보조구(검사홀더·지그)".

- [ ] **Step 5: 폐기 스펙 삭제** — `inspect-aid-inspect-type.spec.ts`는 제거된 `inspectType` 필터를 검증하므로 삭제한다.

- [ ] **Step 6: typecheck + 남은 백엔드 테스트** — `pnpm.cmd run typecheck:backend`, `pnpm.cmd --filter backend test -- inspect-aid`.

- [ ] **Step 7: 커밋** — `refactor(quality): 검사보조구를 홀더·지그 전용으로 좁힌다`

---

### Task 6: BE — 대조 플로우 전환

**Files:**
- Modify: `apps/backend/src/entities/inspect-sample-check-item.entity.ts`
- Modify: `apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.ts`
- Modify: `apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/continuity-inspect/continuity-inspect.module.ts`
- Modify: `apps/backend/src/modules/quality/continuity-inspect/dto/inspect-sample-check.dto.ts`

**Interfaces:**
- Consumes: Task 4의 `LimitSample`, `LimitSampleImage`
- Produces: `SampleCheckCandidate { sampleCode, sampleName, sampleType, expectedResult, requiredYn, sortOrder, imageUrl, defectCode, location, validTo, status, expired }`

- [ ] **Step 1: spec을 새 계약으로 먼저 고친다** — `getRepositoryToken(InspectAid)` → `getRepositoryToken(LimitSample)`, 픽스처 필드명·`SAMPLE_TYPE` 값(OK/NG)으로 교체. 기대 후보의 `sampleCode` 확인.

- [ ] **Step 2: 실패 확인** — `pnpm.cmd --filter backend test -- inspect-sample-check.service.spec` FAIL.

- [ ] **Step 3: 엔티티 컬럼명 교체** — `AID_CODE`→`SAMPLE_CODE`, `AID_TYPE`→`SAMPLE_TYPE`, 프로퍼티 `sampleCode`/`sampleType`. docstring의 기대결과 설명을 `OK→PASS / NG→FAIL`로.

- [ ] **Step 4: 서비스 전환** — `SAMPLE_AID_TYPES` → `SAMPLE_TYPES = ['OK','NG']`, `aidRepository` → `limitSampleRepository` + `limitSampleImageRepository`, `toCandidate`는 대표 사진 1장을 `imageUrl`에 넣는다(후보 집합의 사진을 한 번에 조회해 매핑 — N+1 금지), `expectedResult`는 `sampleType === 'OK' ? 'PASS' : 'FAIL'`.

- [ ] **Step 5: 모듈 forFeature 교체** — `InspectAid` → `LimitSample`, `LimitSampleImage`.

- [ ] **Step 6: DTO 필드명 교체** — `inspect-sample-check.dto.ts`의 `aidCode`/`aidType` → `sampleCode`/`sampleType`.

- [ ] **Step 7: 테스트 통과 + typecheck** — spec PASS, `typecheck:backend` PASS.

- [ ] **Step 8: 커밋** — `refactor(quality): 대조 플로우가 양불마스터를 참조하게 한다`

---

### Task 7: i18n · 메뉴 배선

**Files:**
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`
- Modify: `apps/frontend/src/config/menuConfig.ts`
- Modify: `apps/backend/src/seeds/menu-config.json`
- Modify: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`

- [ ] **Step 1: i18n 키 추가 (4파일 동시)**

- `menu.master.limitSample` (ko "양불마스터")
- 플랫 키 `"master.limitSample"` (사이드바 라벨 맵, ko.json 340행대 블록)
- `master.limitSample.*` — `title/subtitle/searchPlaceholder/sectionBasic/sectionSampleCheck/sectionValidity/sectionImages/sampleCode/sampleType/sampleName/itemCode/processCode/defectCode/defectCodeHint/inspectType/inspectTypeAll/requiredYn/required/requiredHint/sortOrder/location/validFrom/validTo/approvedBy/approvedAt/expiry/expired/expiring/valid/daysAgoSuffix/expiringWithin/images/imageAddHint/imageCaption/imagePrimary/imageSetPrimary/imageDeleteConfirm/imageLoadFailed`
- `comCode.LIMIT_SAMPLE_TYPE.{OK,NG}` = 양품견본/불량견본, `comCode.LIMIT_SAMPLE_STATUS.{ACTIVE,EXPIRED,RETIRED}`
- 설명 블록(`StatusHeaderHelp`용, ko.json 7661행대와 같은 부모)에도 두 그룹 설명 추가
- `master.inspectAid.title/subtitle`을 홀더·지그 전용 문구로 정정, 제거된 필드 키(`inspectType/inspectTypeAll/requiredYn/required/requiredHint/sortOrder/defectCode/defectCodeHint/sectionSampleCheck`) 삭제

- [ ] **Step 2: BOM 검증**

```bash
for f in ko en zh vi; do head -c 3 apps/frontend/src/locales/$f.json | od -c | head -1; done
```
기대: `357 273 277`(BOM)이 나오면 안 된다.

- [ ] **Step 3: 4개 키 정합 검증**

```bash
node scripts/find_missing_i18n.js
```
`master.limitSample.*`가 누락으로 잡히지 않아야 한다.

- [ ] **Step 4: 메뉴 3파일 수정** — 세 파일 모두 `QC_INSPECT_AID` 바로 뒤에 `QC_LIMIT_SAMPLE` 추가. `menuConfig.ts`는 `{ code: "QC_LIMIT_SAMPLE", labelKey: "menu.master.limitSample", path: "/master/limit-sample" }`.

- [ ] **Step 5: 커밋** — `feat(quality): 양불마스터 메뉴와 다국어 문구를 추가한다`

---

### Task 8: FE — 양불마스터 화면 신설

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/limit-sample/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/master/limit-sample/limitSampleColumns.tsx`
- Create: `apps/frontend/src/app/(authenticated)/master/limit-sample/LimitSampleFormPanel.tsx`
- Create: `apps/frontend/src/app/(authenticated)/master/limit-sample/LimitSampleImageSection.tsx`
- Create: `apps/frontend/src/app/(authenticated)/master/limit-sample/limit-sample.structure.test.mjs`
- Create: `apps/frontend/src/components/layout/page-registries/master__limit-sample.generated.ts`
- Modify: `apps/frontend/src/components/layout/pageRegistry.generated.ts`

**Interfaces:**
- Consumes: Task 4의 `/master/limit-samples` API
- Produces: `LimitSampleRow`, `LimitSampleImageRow`, `LimitSampleForm`, `emptyLimitSampleForm()`, `validateLimitSampleForm(form)`, `createLimitSampleGridColumns({ t, onEdit, onDelete })`

- [ ] **Step 1: 구조 테스트 먼저 작성**

`inspect-aid.structure.test.mjs` 패턴. 검증 항목: 패널 액션 버튼이 스크롤 영역 위에 있을 것, `useUnsavedGuard` 사용, `alert(`/`confirm(` 미사용, 파스텔 배경 클래스(`bg-green-50` 등) 미사용, 사용된 `t("master.limitSample.*")` 키가 4개 locale에 모두 존재할 것.

- [ ] **Step 2: 실패 확인** — `node apps/frontend/src/app/\(authenticated\)/master/limit-sample/limit-sample.structure.test.mjs` FAIL(파일 없음).

- [ ] **Step 3: columns 작성** — `inspectAidColumns.tsx` 복제 후: 유형 배지 `LIMIT_SAMPLE_TYPE`, 상태 배지 `LIMIT_SAMPLE_STATUS`, 썸네일은 `primaryImageUrl`, 사진 장수 컬럼 추가, `ExpiryBadge`는 동일 규칙 유지.

- [ ] **Step 4: 사진 섹션 컴포넌트 작성** — 다중 업로드(복수 선택), 각 장 캡션 `Input`, 대표 지정 라디오, 순서 변경(위/아래), 개별 삭제(`ConfirmModal`). 신규 등록 시에는 로컬 큐에 담았다가 저장 후 순차 업로드.

- [ ] **Step 5: 폼 패널 작성** — `InspectAidFormPanel` 패턴. 액션 버튼 상단. 유형은 `ComCodeSelect groupCode="LIMIT_SAMPLE_TYPE"`, 불량코드는 `sampleType === 'NG'`일 때만 활성.

- [ ] **Step 6: page.tsx 작성** — 유형 탭(전체/양품견본/불량견본), 만료·임박 요약, 서버 페이징, `useUnsavedGuard`, 행 클릭 데이터 교체. `sqlQuery`는 `LIMIT_SAMPLES` 기준.

- [ ] **Step 7: 레지스트리 등록** — `master__limit-sample.generated.ts` 생성(기존 생성 파일과 동일 포맷) + `pageRegistry.generated.ts`에 `case "/master/limit-sample"` 추가(알파벳 순서상 `/master/label-template` 뒤). 가능하면 `node scripts/gen-page-registry.mjs`로 재생성.

- [ ] **Step 8: 구조 테스트 PASS + typecheck** — 구조 테스트 PASS, `pnpm.cmd run typecheck:frontend` PASS.

- [ ] **Step 9: 커밋** — `feat(quality): 양불마스터 기준정보 화면을 추가한다`

---

### Task 9: FE — inspect-aid 화면 축소 · 대조 모달 전환

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/inspect-aid/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/inspect-aid/inspectAidColumns.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/inspect-aid/InspectAidFormPanel.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/inspect-aid/inspect-aid.structure.test.mjs`
- Modify: `apps/frontend/src/app/(authenticated)/inspection/result/components/SampleCheckModal.tsx`

- [ ] **Step 1: 타입에서 제거된 4필드 삭제** — `InspectAidType = "HOLDER"`, `InspectAidRow`에서 `defectCode/inspectType/requiredYn/sortOrder` 제거. 해당 컬럼 정의도 제거.

- [ ] **Step 2: 폼 패널 정리** — `sectionSampleCheck` 블록 전체 제거, 불량코드 Select 제거, `emptyInspectAidForm().aidType = "HOLDER"`, `defectCodeOptions` prop 제거.

- [ ] **Step 3: page.tsx 정리** — 유형 탭 제거(`typeTab` 상태·`typeTabs`·탭 UI·`aidType` 파라미터), 불량코드 옵션 fetch 제거, `handleSave` payload에서 4필드 제거, 제목/부제 i18n 키는 그대로(문구만 Task 7에서 교체됨).

- [ ] **Step 4: 구조 테스트 갱신** — 유형 탭 관련 단언이 있으면 제거하고, 제거된 i18n 키를 참조하지 않는지 검증.

- [ ] **Step 5: SampleCheckModal 전환** — `SampleCheckCandidate`의 `aidCode/aidName/aidType` → `sampleCode/sampleName/sampleType`, 배지 `groupCode`를 `LIMIT_SAMPLE_TYPE`으로, docstring의 `INSPECT_AIDS` 언급을 `LIMIT_SAMPLES`로. 스캔 매칭 키도 `sampleCode`.

- [ ] **Step 6: typecheck + 구조 테스트** — `pnpm.cmd run typecheck:frontend` PASS, 두 구조 테스트 PASS.

- [ ] **Step 7: 커밋** — `refactor(quality): 검사보조구 화면과 대조 모달을 새 구조에 맞춘다`

---

### Task 10: 문서 동기화와 최종 검증

**Files:**
- Modify: `docs/database/table-catalog.md`
- Regenerate: `docs/database/schema-erd.md`

- [ ] **Step 1: table-catalog 갱신** — `LIMIT_SAMPLES`/`LIMIT_SAMPLE_IMAGES` 항목 추가(설명, 동의어 "양불마스터"/"한도견본"/"양품견본"/"불량견본", JOIN키 `COMPANY+PLANT_CD+SAMPLE_CODE`), `INSPECT_AIDS` 설명을 홀더·지그 전용으로 정정, `INSPECT_SAMPLE_CHECK_ITEMS`의 컬럼명 갱신.

- [ ] **Step 2: ERD 재생성**

```
ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py
```

- [ ] **Step 3: 전체 검증**

```
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
pnpm.cmd --filter backend test -- limit-sample inspect-sample-check inspect-aid
node scripts/find_missing_i18n.js
```

- [ ] **Step 4: 화면 실동작 확인** — `claude-in-chrome`으로 `/master/limit-sample` 진입, 목록 76건 표시, 등록/수정/사진 대표 지정 1회 왕복, `/master/inspect-aid` 홀더 시드 표시 확인.

- [ ] **Step 5: 커밋** — `docs(database): 양불마스터 분리를 카탈로그와 ERD에 반영한다`

---

## Self-Review

- 스펙 커버리지: 3.1/3.2/3.3→Task 1, 4.1/4.2→Task 2, 5→Task 3·6·9, 6→Task 4·8, 7→Task 7·8·10, 8→각 Task의 검증 스텝, 9(범위 밖)→구현 없음. 누락 없음.
- 타입 정합: `sampleCode`/`sampleType`/`primaryImageUrl`/`images`가 Task 4(서버)→Task 6(대조)→Task 8·9(프론트)에서 같은 이름으로 쓰인다.
- 되돌리기 어려운 작업은 Task 2 Step 5(컬럼 DROP)와 Task 3(리네임)뿐이며, 둘 다 사용자 승인 완료 + 대상 데이터 0건.
