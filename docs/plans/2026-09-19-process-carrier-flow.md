# 공정 대차 적재·이동전표·자동 투입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생산 라벨(SG/FG)과 키팅 원자재 LOT이 어느 대차에 담겨 있는지 실시간으로 추적하고, 이동전표를 발행하며, 후공정에서 대차 한 번 스캔으로 담긴 것을 자동 투입한다.

**Architecture:** 적재 이력 테이블 없이 라벨/LOT 테이블의 `CARRIER_NO` 컬럼이 현재 위치의 단일 출처. 라우팅 공정 플래그 2개(`CARRIER_LOAD_YN` 출력측, `CARRIER_AUTO_INPUT_YN` 입력측)가 화면 동작을 켠다. 백엔드 `CarrierFlowService`가 상태 도출·검증·전표·자동투입 목록을 맡고, 프론트는 공용 `components/shared/carrier`를 세 화면(가공·서브조립·조립)과 자재 출고 화면이 조립만 한다. 자동 투입은 화면이 이미 쓰는 바코드 처리기를 반복 호출한다.

**Tech Stack:** NestJS + TypeORM(Oracle), Next.js 15 + react-i18next, node:test 구조 테스트, Jest 백엔드 spec, oracle-db connector 마이그레이션.

**Spec:** `docs/specs/2026-09-19-process-carrier-flow-design.md` (1~12절 전부, 특히 12절 원자재 대차 보완)

## Global Constraints

- 패키지 매니저 `pnpm`만. typecheck는 `pnpm.cmd run typecheck:backend`, `pnpm.cmd run typecheck:frontend`. dev 서버가 떠 있으면 `pnpm build` 금지.
- DB 변경은 SQL 파일 작성 후 `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <file>`로 즉시 적용하고 pre/post 조회를 기록. 블록은 `/` 라인으로 분리. 적용 후 `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`.
- 회사/플랜트 시드는 company=`40`, plant=`1000`.
- CREATED_AT/UPDATED_AT은 `DEFAULT SYSTIMESTAMP`. nullable union 컬럼(`string | null`)은 `@Column`에 `type` 명시.
- i18n은 ko/en/zh/vi 4개 파일 동시 수정, JSON에 BOM 금지.
- 메뉴 추가는 4곳 동시: `apps/frontend/src/config/menuConfig.ts`, `apps/backend/src/seeds/menu-config.json`, `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`, DB `MENU_CATEGORY_ITEMS` MERGE.
- `alert/confirm/prompt` 금지, 파스텔 배경(`bg-*-50/100`) 금지, 코드값은 `ComCodeSelect`/`ComCodeBadge`, 바코드 입력은 `BarcodeScanInput`.
- `catch (error: unknown)` 유지, `as any` 금지. 멀티테넌시 `company`, `plant` 스코프 필수.
- 커밋은 main 직접, 파일 단위 `git add`, 멀티라인 메시지는 임시파일 `-F`, push 금지. 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 메뉴 코드: 기준정보 `MST_CARRIER`(`/master/carrier`), 생산 `PROD_CARRIER_STATUS`(`/production/carrier-status`). 공통코드 그룹 `CARRIER_TYPE`(CART/TRAY/MAGAZINE). 시퀀스 `SEQ_CARRIER_SLIP`, 전표번호 형식 `CS` + YYMMDD + `-` + 5자리.

---

## 파일 구조

**백엔드 신규**
- `apps/backend/src/migrations/2026-09-19_carrier_flow.sql` — 테이블·컬럼·시퀀스·공통코드·메뉴
- `apps/backend/src/entities/carrier-master.entity.ts`
- `apps/backend/src/modules/master/dto/carrier.dto.ts`, `services/carrier.service.ts`(+spec), `controllers/carrier.controller.ts`
- `apps/backend/src/modules/production/services/carrier-flow.rules.ts`(+spec) — 순수 규칙(상태 도출, 적재 가능 판정, 전표번호 형식)
- `apps/backend/src/modules/production/services/carrier-flow.service.ts`(+spec), `controllers/carrier-flow.controller.ts`, `dto/carrier-flow.dto.ts`

**백엔드 수정**
- 엔티티: `sg-label`, `fg-label`, `mat-lot`, `prod-result`, `routing-process`, `equip-master` + `entities/index.ts`
- `modules/master/master.module.ts`, `modules/production/production.module.ts`
- `modules/master/dto/routing-group.dto.ts`, `services/routing-group.service.ts`
- `modules/production/services/prod-result.service.ts`, `subprocess-kitting.service.ts`, `equip-material.service.ts`, `dto/prod-result.dto.ts`, `dto/subprocess-kitting.dto.ts`
- `modules/material/dto/scan-issue.dto.ts`, `dto/mat-issue.dto.ts`, `services/mat-issue.service.ts`
- `shared/numbering.service.ts`
- `modules/menu-categories/utils/menu-code-validator.ts`, `seeds/menu-config.json`
- `tools/seed/reset_transactional_data.py` KEEP에 `CARRIER_MASTERS`

**프론트 신규**
- `components/shared/carrier/carrierTypes.ts`, `useOutputCarrier.ts`, `OutputCarrierSlot.tsx`, `CarrierSlipPrintModal.tsx`, `useCarrierAutoInput.ts`, `index.ts`, `carrier.structure.test.mjs`
- `app/(authenticated)/master/carrier/page.tsx`, `carrierColumns.tsx`, `CarrierFormPanel.tsx`, `CarrierLabelModal.tsx`, `carrier.structure.test.mjs`
- `app/(authenticated)/production/carrier-status/page.tsx`, `carrierStatusColumns.tsx`, `CarrierContentsPanel.tsx`, `carrier-status.structure.test.mjs`

**프론트 수정**
- `config/menuConfig.ts`, `locales/{ko,en,zh,vi}.json`
- `master/routing/components/RoutingGroupManager.tsx`, `RoutingFieldHelp.tsx`
- `production/input-kiosk/page.tsx`, `components/EquipHeader.tsx`, `components/ProductionInputBar.tsx`, `components/MaterialScanModal.tsx`, `components/KioskPrepGuideModal.tsx`, `utils/kioskPrepGuideSteps.ts`, `input-kiosk-prep-guide.structure.test.mjs`
- `production/subprocess-kitting/page.tsx`, `components/InputSgScanPanel.tsx`
- `production/input-assembly/page.tsx`, `components/SgScanPanel.tsx`, `components/AssemblyPrepGuideModal.tsx`, `assemblyPrepGuideSteps.ts`
- `material/issue/components/IssueScanPanel.tsx`, `hooks/material/useBarcodeScan.ts`
- `docs/standards/numbering-rules.md`

---

## 1단계 — DB·엔티티·마스터·라우팅 플래그·메뉴

### Task 1: 마이그레이션 SQL 작성·적용·ERD 갱신

**Files:**
- Create: `apps/backend/src/migrations/2026-09-19_carrier_flow.sql`
- Modify: `apps/backend/src/migrations/README.md` (실행 순서 표 끝에 한 줄)
- Modify: `docs/standards/numbering-rules.md` (5절 표 아래에 전표 규칙 한 줄)

**Interfaces:**
- Produces: 테이블 `CARRIER_MASTERS`, 컬럼 `SG_LABELS/FG_LABELS/MAT_LOTS.(CARRIER_NO, CARRIER_LOADED_AT, CARRIER_SLIP_NO)`, `PROD_RESULTS.CARRIER_NO`, `ROUTING_PROCESSES.(CARRIER_LOAD_YN, CARRIER_AUTO_INPUT_YN)`, `EQUIP_MASTERS.CUR_CARRIER_NO`, 시퀀스 `SEQ_CARRIER_SLIP`, 공통코드 `CARRIER_TYPE`, 메뉴 `MST_CARRIER`, `PROD_CARRIER_STATUS`

- [ ] **Step 1: 사전 실측 (테이블·컬럼 부재 확인)**

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT TABLE_NAME, COLUMN_NAME FROM USER_TAB_COLUMNS WHERE COLUMN_NAME LIKE 'CARRIER%' OR TABLE_NAME = 'CARRIER_MASTERS'"
```
Expected: 0 rows.

- [ ] **Step 2: SQL 파일 작성**

```sql
-- 공정 대차 적재·이동전표·자동 투입 — docs/specs/2026-09-19-process-carrier-flow-design.md 3절·12절
-- 대상: JSHANES company=40 plant=1000. 멱등(존재 확인 후 생성, 코드/메뉴는 MERGE).
-- 실행: python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <this file>
-- 적용 후: ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py

-- 1) 대차 마스터
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM USER_TABLES WHERE TABLE_NAME = 'CARRIER_MASTERS';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE TABLE CARRIER_MASTERS (
      COMPANY        VARCHAR2(50)   NOT NULL,
      PLANT_CD       VARCHAR2(50)   NOT NULL,
      CARRIER_NO     VARCHAR2(30)   NOT NULL,
      CARRIER_TYPE   VARCHAR2(20)   NOT NULL,
      CARRIER_NAME   VARCHAR2(100),
      CAPACITY       NUMBER,
      USE_YN         CHAR(1)        DEFAULT ''Y'' NOT NULL,
      REMARK         VARCHAR2(500),
      CREATED_BY     VARCHAR2(50),
      UPDATED_BY     VARCHAR2(50),
      CREATED_AT     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
      UPDATED_AT     TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT PK_CARRIER_MASTERS PRIMARY KEY (COMPANY, PLANT_CD, CARRIER_NO),
      CONSTRAINT CK_CARRIER_MASTERS_TYPE CHECK (CARRIER_TYPE IN (''CART'',''TRAY'',''MAGAZINE'')),
      CONSTRAINT CK_CARRIER_MASTERS_USE_YN CHECK (USE_YN IN (''Y'',''N'')),
      CONSTRAINT CK_CARRIER_MASTERS_CAPACITY CHECK (CAPACITY IS NULL OR CAPACITY > 0)
    )';
    EXECUTE IMMEDIATE q'[COMMENT ON TABLE CARRIER_MASTERS IS '대차/트레이/매거진 마스터 — 생산 라벨·키팅 LOT을 담아 공정 간 이동하는 운반구']';
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN CARRIER_MASTERS.CARRIER_NO IS '대차번호(바코드 값). 수동 입력']';
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN CARRIER_MASTERS.CARRIER_TYPE IS '운반구 유형 (COM_CODES CARRIER_TYPE: CART 대차 / TRAY 트레이 / MAGAZINE 매거진)']';
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN CARRIER_MASTERS.CAPACITY IS '최대 적재 라벨/LOT 수. NULL=무제한']';
  END IF;
END;
/
-- 2) 라벨·LOT·실적·라우팅·설비 컬럼
DECLARE
  PROCEDURE add_col(p_table VARCHAR2, p_col VARCHAR2, p_ddl VARCHAR2, p_comment VARCHAR2) IS
    n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM USER_TAB_COLUMNS WHERE TABLE_NAME = p_table AND COLUMN_NAME = p_col;
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD (' || p_col || ' ' || p_ddl || ')';
    END IF;
    EXECUTE IMMEDIATE 'COMMENT ON COLUMN ' || p_table || '.' || p_col || ' IS ''' || p_comment || '''';
  END;
BEGIN
  add_col('SG_LABELS', 'CARRIER_NO', 'VARCHAR2(30)', '현재 담긴 대차번호(CARRIER_MASTERS). 소비/취소 시 NULL');
  add_col('SG_LABELS', 'CARRIER_LOADED_AT', 'TIMESTAMP', '대차 적재 일시');
  add_col('SG_LABELS', 'CARRIER_SLIP_NO', 'VARCHAR2(30)', '이동전표번호. 발행되면 추가 적재 불가·자동투입 허용');
  add_col('FG_LABELS', 'CARRIER_NO', 'VARCHAR2(30)', '현재 담긴 대차번호(CARRIER_MASTERS). 소비/취소 시 NULL');
  add_col('FG_LABELS', 'CARRIER_LOADED_AT', 'TIMESTAMP', '대차 적재 일시');
  add_col('FG_LABELS', 'CARRIER_SLIP_NO', 'VARCHAR2(30)', '이동전표번호');
  add_col('MAT_LOTS', 'CARRIER_NO', 'VARCHAR2(30)', '키팅 출고 시 담긴 대차번호. 설비 장착/출고 취소 시 NULL');
  add_col('MAT_LOTS', 'CARRIER_LOADED_AT', 'TIMESTAMP', '대차 적재 일시');
  add_col('MAT_LOTS', 'CARRIER_SLIP_NO', 'VARCHAR2(30)', '이동전표번호(원자재 대차는 선택)');
  add_col('PROD_RESULTS', 'CARRIER_NO', 'VARCHAR2(30)', '실적 시점 출력 대차번호(보존용)');
  add_col('ROUTING_PROCESSES', 'CARRIER_LOAD_YN', 'CHAR(1) DEFAULT ''N''', '출력측: 이 공정 실적 라벨을 대차에 담는다 Y/N (라벨 발행 공정만 Y 가능)');
  add_col('ROUTING_PROCESSES', 'CARRIER_AUTO_INPUT_YN', 'CHAR(1) DEFAULT ''N''', '입력측: 이 공정에서 대차 스캔 시 담긴 것을 자동 투입한다 Y/N');
  add_col('EQUIP_MASTERS', 'CUR_CARRIER_NO', 'VARCHAR2(30)', '설비의 현재 출력 대차번호(재진입 복원용)');
END;
/
-- 3) 인덱스
DECLARE
  n NUMBER;
BEGIN
  FOR r IN (SELECT 'IX_SG_LABELS_CARRIER' ix, 'SG_LABELS' tb FROM DUAL UNION ALL
            SELECT 'IX_FG_LABELS_CARRIER', 'FG_LABELS' FROM DUAL UNION ALL
            SELECT 'IX_MAT_LOTS_CARRIER', 'MAT_LOTS' FROM DUAL) LOOP
    SELECT COUNT(*) INTO n FROM USER_INDEXES WHERE INDEX_NAME = r.ix;
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'CREATE INDEX ' || r.ix || ' ON ' || r.tb || ' (COMPANY, PLANT_CD, CARRIER_NO)';
    END IF;
  END LOOP;
END;
/
-- 4) 이동전표 시퀀스
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM USER_SEQUENCES WHERE SEQUENCE_NAME = 'SEQ_CARRIER_SLIP';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_CARRIER_SLIP START WITH 1 INCREMENT BY 1 NOCACHE';
  END IF;
END;
/
-- 5) 공통코드 CARRIER_TYPE
MERGE INTO COM_CODES t
USING (SELECT 'CARRIER_TYPE' GROUP_CODE,'CART' DETAIL_CODE,'대차' CODE_NAME,1 SORT_ORDER,'bg-blue-600 text-white' ATTR1,'40' COMPANY,'1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE=s.GROUP_CODE AND t.DETAIL_CODE=s.DETAIL_CODE AND t.COMPANY=s.COMPANY AND t.PLANT_CD=s.PLANT_CD)
WHEN MATCHED THEN UPDATE SET t.CODE_NAME=s.CODE_NAME, t.SORT_ORDER=s.SORT_ORDER, t.USE_YN='Y'
WHEN NOT MATCHED THEN INSERT (GROUP_CODE,DETAIL_CODE,CODE_NAME,SORT_ORDER,USE_YN,ATTR1,COMPANY,PLANT_CD,CREATED_BY) VALUES (s.GROUP_CODE,s.DETAIL_CODE,s.CODE_NAME,s.SORT_ORDER,'Y',s.ATTR1,s.COMPANY,s.PLANT_CD,'claude')
/
MERGE INTO COM_CODES t
USING (SELECT 'CARRIER_TYPE' GROUP_CODE,'TRAY' DETAIL_CODE,'트레이' CODE_NAME,2 SORT_ORDER,'bg-teal-600 text-white' ATTR1,'40' COMPANY,'1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE=s.GROUP_CODE AND t.DETAIL_CODE=s.DETAIL_CODE AND t.COMPANY=s.COMPANY AND t.PLANT_CD=s.PLANT_CD)
WHEN MATCHED THEN UPDATE SET t.CODE_NAME=s.CODE_NAME, t.SORT_ORDER=s.SORT_ORDER, t.USE_YN='Y'
WHEN NOT MATCHED THEN INSERT (GROUP_CODE,DETAIL_CODE,CODE_NAME,SORT_ORDER,USE_YN,ATTR1,COMPANY,PLANT_CD,CREATED_BY) VALUES (s.GROUP_CODE,s.DETAIL_CODE,s.CODE_NAME,s.SORT_ORDER,'Y',s.ATTR1,s.COMPANY,s.PLANT_CD,'claude')
/
MERGE INTO COM_CODES t
USING (SELECT 'CARRIER_TYPE' GROUP_CODE,'MAGAZINE' DETAIL_CODE,'매거진' CODE_NAME,3 SORT_ORDER,'bg-purple-600 text-white' ATTR1,'40' COMPANY,'1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE=s.GROUP_CODE AND t.DETAIL_CODE=s.DETAIL_CODE AND t.COMPANY=s.COMPANY AND t.PLANT_CD=s.PLANT_CD)
WHEN MATCHED THEN UPDATE SET t.CODE_NAME=s.CODE_NAME, t.SORT_ORDER=s.SORT_ORDER, t.USE_YN='Y'
WHEN NOT MATCHED THEN INSERT (GROUP_CODE,DETAIL_CODE,CODE_NAME,SORT_ORDER,USE_YN,ATTR1,COMPANY,PLANT_CD,CREATED_BY) VALUES (s.GROUP_CODE,s.DETAIL_CODE,s.CODE_NAME,s.SORT_ORDER,'Y',s.ATTR1,s.COMPANY,s.PLANT_CD,'claude')
/
-- 6) 공통코드 CARRIER_STATUS (현황 화면 배지용, 값은 도출값)
MERGE INTO COM_CODES t
USING (SELECT 'CARRIER_STATUS' GROUP_CODE,'EMPTY' DETAIL_CODE,'빈 대차' CODE_NAME,1 SORT_ORDER,'bg-gray-600 text-white' ATTR1,'40' COMPANY,'1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE=s.GROUP_CODE AND t.DETAIL_CODE=s.DETAIL_CODE AND t.COMPANY=s.COMPANY AND t.PLANT_CD=s.PLANT_CD)
WHEN MATCHED THEN UPDATE SET t.CODE_NAME=s.CODE_NAME, t.SORT_ORDER=s.SORT_ORDER, t.USE_YN='Y'
WHEN NOT MATCHED THEN INSERT (GROUP_CODE,DETAIL_CODE,CODE_NAME,SORT_ORDER,USE_YN,ATTR1,COMPANY,PLANT_CD,CREATED_BY) VALUES (s.GROUP_CODE,s.DETAIL_CODE,s.CODE_NAME,s.SORT_ORDER,'Y',s.ATTR1,s.COMPANY,s.PLANT_CD,'claude')
/
MERGE INTO COM_CODES t
USING (SELECT 'CARRIER_STATUS' GROUP_CODE,'LOADING' DETAIL_CODE,'적재 중' CODE_NAME,2 SORT_ORDER,'bg-amber-600 text-white' ATTR1,'40' COMPANY,'1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE=s.GROUP_CODE AND t.DETAIL_CODE=s.DETAIL_CODE AND t.COMPANY=s.COMPANY AND t.PLANT_CD=s.PLANT_CD)
WHEN MATCHED THEN UPDATE SET t.CODE_NAME=s.CODE_NAME, t.SORT_ORDER=s.SORT_ORDER, t.USE_YN='Y'
WHEN NOT MATCHED THEN INSERT (GROUP_CODE,DETAIL_CODE,CODE_NAME,SORT_ORDER,USE_YN,ATTR1,COMPANY,PLANT_CD,CREATED_BY) VALUES (s.GROUP_CODE,s.DETAIL_CODE,s.CODE_NAME,s.SORT_ORDER,'Y',s.ATTR1,s.COMPANY,s.PLANT_CD,'claude')
/
MERGE INTO COM_CODES t
USING (SELECT 'CARRIER_STATUS' GROUP_CODE,'IN_TRANSIT' DETAIL_CODE,'이동 중' CODE_NAME,3 SORT_ORDER,'bg-green-600 text-white' ATTR1,'40' COMPANY,'1000' PLANT_CD FROM DUAL) s
ON (t.GROUP_CODE=s.GROUP_CODE AND t.DETAIL_CODE=s.DETAIL_CODE AND t.COMPANY=s.COMPANY AND t.PLANT_CD=s.PLANT_CD)
WHEN MATCHED THEN UPDATE SET t.CODE_NAME=s.CODE_NAME, t.SORT_ORDER=s.SORT_ORDER, t.USE_YN='Y'
WHEN NOT MATCHED THEN INSERT (GROUP_CODE,DETAIL_CODE,CODE_NAME,SORT_ORDER,USE_YN,ATTR1,COMPANY,PLANT_CD,CREATED_BY) VALUES (s.GROUP_CODE,s.DETAIL_CODE,s.CODE_NAME,s.SORT_ORDER,'Y',s.ATTR1,s.COMPANY,s.PLANT_CD,'claude')
/
-- 7) 메뉴: 기준정보 대차관리(MST_VALIDATION 다음), 생산 대차현황(PROD_PRODUCT_TRANS 다음)
MERGE INTO MENU_CATEGORY_ITEMS t
USING (SELECT 'MST_CARRIER' MENU_CODE, 'MASTER' CATEGORY_CODE,
              (SELECT NVL(MAX(SORT_ORDER),0)+1 FROM MENU_CATEGORY_ITEMS WHERE CATEGORY_CODE='MASTER' AND COMPANY='40' AND PLANT_CD='1000') SORT_ORDER,
              '40' COMPANY, '1000' PLANT_CD FROM DUAL) s
ON (t.MENU_CODE = s.MENU_CODE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN
  INSERT (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
  VALUES (s.MENU_CODE, s.CATEGORY_CODE, s.SORT_ORDER, s.COMPANY, s.PLANT_CD, SYSTIMESTAMP, 'system', SYSTIMESTAMP, 'system')
/
MERGE INTO MENU_CATEGORY_ITEMS t
USING (SELECT 'PROD_CARRIER_STATUS' MENU_CODE, 'PRODUCTION' CATEGORY_CODE,
              (SELECT NVL(MAX(SORT_ORDER),0)+1 FROM MENU_CATEGORY_ITEMS WHERE CATEGORY_CODE='PRODUCTION' AND COMPANY='40' AND PLANT_CD='1000') SORT_ORDER,
              '40' COMPANY, '1000' PLANT_CD FROM DUAL) s
ON (t.MENU_CODE = s.MENU_CODE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN
  INSERT (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
  VALUES (s.MENU_CODE, s.CATEGORY_CODE, s.SORT_ORDER, s.COMPANY, s.PLANT_CD, SYSTIMESTAMP, 'system', SYSTIMESTAMP, 'system')
/
COMMIT
/
```

- [ ] **Step 3: 적용**

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-09-19_carrier_flow.sql
```
Expected: 오류 없이 각 블록 성공. ORA-00933이 나면 `/` 분리 형식을 고치고 재실행.

- [ ] **Step 4: 사후 실측**

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT TABLE_NAME, COLUMN_NAME FROM USER_TAB_COLUMNS WHERE COLUMN_NAME LIKE 'CARRIER%' OR COLUMN_NAME='CUR_CARRIER_NO' ORDER BY 1,2"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT GROUP_CODE, DETAIL_CODE, CODE_NAME FROM COM_CODES WHERE GROUP_CODE IN ('CARRIER_TYPE','CARRIER_STATUS') ORDER BY 1,2"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT MENU_CODE, CATEGORY_CODE, SORT_ORDER FROM MENU_CATEGORY_ITEMS WHERE MENU_CODE IN ('MST_CARRIER','PROD_CARRIER_STATUS')"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT OBJECT_NAME FROM USER_OBJECTS WHERE STATUS='INVALID' AND OBJECT_TYPE IN ('PACKAGE','PACKAGE BODY','PROCEDURE','FUNCTION','TRIGGER')"
```
Expected: 컬럼 13행, 코드 6행, 메뉴 2행, INVALID 0행. INVALID가 있으면 `ALTER PACKAGE <name> COMPILE`을 같은 connector로 실행.

- [ ] **Step 5: ERD·문서 갱신**

```powershell
$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py
```
README 실행 순서 표 끝에 `| N | 2026-09-19_carrier_flow.sql | 대차 마스터·라벨/LOT 대차 컬럼·이동전표 시퀀스·CARRIER_TYPE 코드·메뉴 |` 추가. numbering-rules.md 5절 표 아래에 다음 절 추가:

```markdown
## 5-1. 이동전표번호 (대차)

| 채번 | 형식 | 시퀀스 | 리셋 |
|---|---|---|---|
| `CARRIER_SLIP` | `CS` + YYMMDD + `-` + 5자리 | `SEQ_CARRIER_SLIP` (전역) | 없음 (날짜는 가독성용, 유일성은 시퀀스) |

- 구현: `NumberingService.nextCarrierSlipNo`. 발행 시 대차에 담긴 라벨/LOT의 `CARRIER_SLIP_NO`에 같은 번호를 찍는다. 재발행은 같은 번호.
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/migrations/2026-09-19_carrier_flow.sql apps/backend/src/migrations/README.md docs/standards/numbering-rules.md docs/database/schema-erd.md
git commit -F "$TEMP/cm.txt"   # 메시지: "feat(db): 대차 마스터와 라벨·LOT 대차 컬럼, 이동전표 시퀀스를 추가한다"
```

---

### Task 2: 엔티티·모듈 등록·채번·초기화 화이트리스트

**Files:**
- Create: `apps/backend/src/entities/carrier-master.entity.ts`
- Modify: `apps/backend/src/entities/index.ts`, `sg-label.entity.ts`, `fg-label.entity.ts`, `mat-lot.entity.ts`, `prod-result.entity.ts`, `routing-process.entity.ts`, `equip-master.entity.ts`
- Modify: `apps/backend/src/modules/master/master.module.ts`, `apps/backend/src/modules/production/production.module.ts`, `apps/backend/src/modules/material/material.module.ts`(MatLot는 이미 있음, CarrierMaster 추가)
- Modify: `apps/backend/src/shared/numbering.service.ts`
- Modify: `tools/seed/reset_transactional_data.py`

**Interfaces:**
- Produces: `CarrierMaster { company, plant, carrierNo, carrierType, carrierName, capacity, useYn, remark, createdBy, updatedBy, createdAt, updatedAt }`; `SgLabel/FgLabel/MatLot.carrierNo: string|null, carrierLoadedAt: Date|null, carrierSlipNo: string|null`; `ProdResult.carrierNo`; `RoutingProcess.carrierLoadYn: string, carrierAutoInputYn: string`; `EquipMaster.curCarrierNo: string|null`; `NumberingService.nextCarrierSlipNo(qr?, txDate?)`

- [ ] **Step 1: 엔티티 신규**

```ts
/**
 * @file carrier-master.entity.ts
 * @description 대차/트레이/매거진 마스터 — 생산 라벨(SG/FG)과 키팅 원자재 LOT을 담아 공정 간 이동하는 운반구
 *
 * 초보자 가이드:
 * 1. PK: COMPANY + PLANT_CD + CARRIER_NO. CARRIER_NO가 바코드 값이며 수동 입력.
 * 2. 현재 상태(EMPTY/LOADING/IN_TRANSIT)는 여기 저장하지 않는다. SG_LABELS/FG_LABELS/MAT_LOTS.CARRIER_NO로 도출한다.
 * 3. CAPACITY는 NULL이면 무제한.
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'CARRIER_MASTERS' })
export class CarrierMaster {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'CARRIER_NO', length: 30 })
  carrierNo: string;

  /** 공통코드 CARRIER_TYPE: CART / TRAY / MAGAZINE */
  @Column({ name: 'CARRIER_TYPE', length: 20 })
  carrierType: string;

  @Column({ type: 'varchar2', name: 'CARRIER_NAME', length: 100, nullable: true })
  carrierName: string | null;

  /** 최대 적재 수. NULL=무제한 */
  @Column({ name: 'CAPACITY', type: 'number', nullable: true })
  capacity: number | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```
`entities/index.ts`에 `export * from './carrier-master.entity';` 추가.

- [ ] **Step 2: 기존 엔티티 컬럼 추가**

`sg-label.entity.ts` `warehouseCode` 아래, `fg-label.entity.ts` `boxNo` 아래, `mat-lot.entity.ts` `status` 아래에 동일 블록:

```ts
  /** 현재 담긴 대차번호(CARRIER_MASTERS). 소비·취소 시 NULL — 대차 위치의 단일 출처 */
  @Column({ type: 'varchar2', name: 'CARRIER_NO', length: 30, nullable: true })
  carrierNo: string | null;

  @Column({ name: 'CARRIER_LOADED_AT', type: 'timestamp', nullable: true })
  carrierLoadedAt: Date | null;

  /** 이동전표번호. 발행되면 추가 적재 불가, 생산 대차는 자동투입 허용 조건 */
  @Column({ type: 'varchar2', name: 'CARRIER_SLIP_NO', length: 30, nullable: true })
  carrierSlipNo: string | null;
```

`prod-result.entity.ts` `processCode` 아래:
```ts
  /** 실적 시점 출력 대차번호(보존). 라벨이 꺼내진 뒤에도 남는다 */
  @Column({ type: 'varchar2', name: 'CARRIER_NO', length: 30, nullable: true })
  carrierNo: string | null;
```

`routing-process.entity.ts` `sampleQty` 아래:
```ts
  /** 출력측: 이 공정 실적 라벨을 대차에 담는다(라벨 발행 공정만 Y 가능) */
  @Column({ name: 'CARRIER_LOAD_YN', length: 1, default: 'N' })
  carrierLoadYn: string;

  /** 입력측: 이 공정에서 대차 스캔 시 담긴 것을 자동 투입한다 */
  @Column({ name: 'CARRIER_AUTO_INPUT_YN', length: 1, default: 'N' })
  carrierAutoInputYn: string;
```

`equip-master.entity.ts` `currentWorkerCodes` 아래:
```ts
  /** 설비의 현재 출력 대차번호(재진입 복원용). 전표 발행 시 NULL */
  @Column({ type: 'varchar2', name: 'CUR_CARRIER_NO', length: 30, nullable: true })
  curCarrierNo: string | null;
```

- [ ] **Step 3: 모듈 등록**

`master.module.ts`: import `CarrierMaster`를 `TypeOrmModule.forFeature([...])`에 추가. `production.module.ts`: forFeature 배열에 `CarrierMaster`, `MatLot` 추가(MatLot는 이미 있음, CarrierMaster만). `material.module.ts` forFeature에 `CarrierMaster` 추가.

- [ ] **Step 4: 채번 메서드**

`numbering.service.ts` `nextSgLabel` 아래:
```ts
  /** 대차 이동전표번호 채번: CS + YYMMDD + '-' + 5자리(전역 시퀀스 SEQ_CARRIER_SLIP). 날짜는 가독성용, 유일성은 시퀀스 보장. */
  async nextCarrierSlipNo(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_CARRIER_SLIP.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `CS${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }
```

- [ ] **Step 5: 초기화 도구 화이트리스트**

`tools/seed/reset_transactional_data.py` KEEP의 `"EQUIP_MASTERS", ...` 줄 아래에 `"CARRIER_MASTERS",` 추가.

- [ ] **Step 6: typecheck**

```powershell
pnpm.cmd run typecheck:backend
```
Expected: 출력 없이 종료(오류 0).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/entities/carrier-master.entity.ts apps/backend/src/entities/index.ts apps/backend/src/entities/sg-label.entity.ts apps/backend/src/entities/fg-label.entity.ts apps/backend/src/entities/mat-lot.entity.ts apps/backend/src/entities/prod-result.entity.ts apps/backend/src/entities/routing-process.entity.ts apps/backend/src/entities/equip-master.entity.ts apps/backend/src/modules/master/master.module.ts apps/backend/src/modules/production/production.module.ts apps/backend/src/modules/material/material.module.ts apps/backend/src/shared/numbering.service.ts tools/seed/reset_transactional_data.py
git commit -F "$TEMP/cm.txt"   # "feat(entity): 대차 마스터 엔티티와 라벨·LOT·라우팅·설비 대차 컬럼을 매핑한다"
```

---

### Task 3: 라우팅 공정 플래그 DTO·서비스 검증

**Files:**
- Modify: `apps/backend/src/modules/master/dto/routing-group.dto.ts` (`issueLabelType` 아래)
- Modify: `apps/backend/src/modules/master/services/routing-group.service.ts` (createProcess L240 부근, updateProcess L284 부근)
- Create: `apps/backend/src/modules/master/services/routing-carrier-flag.rules.ts`
- Test: `apps/backend/src/modules/master/services/routing-carrier-flag.rules.spec.ts`

**Interfaces:**
- Produces: `assertCarrierLoadFlag(carrierLoadYn: string | undefined, issueLabelType: string | null | undefined): void` — `Y`인데 라벨유형이 NONE/null이면 `BadRequestException('대차 적재는 라벨 발행 공정(BUNDLE/SG/FG)에서만 켤 수 있습니다.')`

- [ ] **Step 1: 실패 테스트**

```ts
import { BadRequestException } from '@nestjs/common';
import { assertCarrierLoadFlag } from './routing-carrier-flag.rules';

describe('assertCarrierLoadFlag', () => {
  it('라벨 발행 공정(SG/BUNDLE/FG)은 Y 허용', () => {
    expect(() => assertCarrierLoadFlag('Y', 'SG')).not.toThrow();
    expect(() => assertCarrierLoadFlag('Y', 'BUNDLE')).not.toThrow();
    expect(() => assertCarrierLoadFlag('Y', 'FG')).not.toThrow();
  });
  it('라벨 없는 공정(NONE/null)에서 Y면 400', () => {
    expect(() => assertCarrierLoadFlag('Y', 'NONE')).toThrow(BadRequestException);
    expect(() => assertCarrierLoadFlag('Y', null)).toThrow(BadRequestException);
  });
  it('N이거나 미지정이면 라벨유형과 무관하게 통과', () => {
    expect(() => assertCarrierLoadFlag('N', 'NONE')).not.toThrow();
    expect(() => assertCarrierLoadFlag(undefined, null)).not.toThrow();
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/master/services/routing-carrier-flag.rules.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: 규칙 구현**

```ts
/**
 * @file routing-carrier-flag.rules.ts
 * @description 라우팅 공정 대차 플래그 규칙 — 대차 적재(CARRIER_LOAD_YN)는 라벨이 발행되는 공정에서만 켤 수 있다.
 *              라벨이 없으면 대차에 담을 바코드가 없어 후공정 자동 투입이 성립하지 않는다(설계 3-3절).
 */
import { BadRequestException } from '@nestjs/common';

export const CARRIER_LOADABLE_LABEL_TYPES = ['BUNDLE', 'SG', 'FG'] as const;

export function assertCarrierLoadFlag(
  carrierLoadYn: string | undefined,
  issueLabelType: string | null | undefined,
): void {
  if (carrierLoadYn !== 'Y') return;
  if (!issueLabelType || !(CARRIER_LOADABLE_LABEL_TYPES as readonly string[]).includes(issueLabelType)) {
    throw new BadRequestException('대차 적재는 라벨 발행 공정(BUNDLE/SG/FG)에서만 켤 수 있습니다.');
  }
}
```

- [ ] **Step 4: DTO·서비스 연결**

DTO(`issueLabelType` 아래):
```ts
  @ApiPropertyOptional({ description: '출력측: 실적 라벨을 대차에 담는다 (라벨 발행 공정만 Y)', default: 'N' })
  @IsOptional() @IsString() @IsIn([...USE_YN_VALUES])
  carrierLoadYn?: string;

  @ApiPropertyOptional({ description: '입력측: 대차 스캔 시 담긴 것을 자동 투입한다', default: 'N' })
  @IsOptional() @IsString() @IsIn([...USE_YN_VALUES])
  carrierAutoInputYn?: string;
```
createProcess의 `issueLabelType: dto.issueLabelType ?? 'NONE',` 아래에 `carrierLoadYn: dto.carrierLoadYn ?? 'N', carrierAutoInputYn: dto.carrierAutoInputYn ?? 'N',` 추가하고, 그 객체를 만들기 직전에 `assertCarrierLoadFlag(dto.carrierLoadYn, dto.issueLabelType ?? 'NONE');` 호출.
updateProcess의 Pick 유니온에 `| 'carrierLoadYn' | 'carrierAutoInputYn'` 추가, 스프레드에 `...(dto.carrierLoadYn !== undefined ? { carrierLoadYn: dto.carrierLoadYn } : {}), ...(dto.carrierAutoInputYn !== undefined ? { carrierAutoInputYn: dto.carrierAutoInputYn } : {}),` 추가. patch 적용 직전에 기존 행과 합쳐 검증: `assertCarrierLoadFlag(dto.carrierLoadYn ?? existing.carrierLoadYn, dto.issueLabelType ?? existing.issueLabelType);` (기존 행 변수명은 해당 메서드가 조회한 변수명을 그대로 쓴다).

- [ ] **Step 5: 테스트·typecheck**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/master/services/routing-carrier-flag.rules.spec.ts
pnpm.cmd run typecheck:backend
```
Expected: 3 passed, typecheck 오류 0.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/master/dto/routing-group.dto.ts apps/backend/src/modules/master/services/routing-group.service.ts apps/backend/src/modules/master/services/routing-carrier-flag.rules.ts apps/backend/src/modules/master/services/routing-carrier-flag.rules.spec.ts
git commit -F "$TEMP/cm.txt"   # "feat(routing): 공정별 대차 적재·자동투입 플래그를 저장하고 라벨 발행 공정만 적재를 허용한다"
```

---

### Task 4: 대차 마스터 API

**Files:**
- Create: `apps/backend/src/modules/master/dto/carrier.dto.ts`, `services/carrier.service.ts`, `controllers/carrier.controller.ts`
- Test: `apps/backend/src/modules/master/services/carrier.service.spec.ts`
- Modify: `apps/backend/src/modules/master/master.module.ts` (controllers, providers, exports)

**Interfaces:**
- Produces: `GET /master/carriers?search&carrierType&useYn&page&limit` → paged `CarrierMaster[]`; `GET /master/carriers/:carrierNo`; `POST /master/carriers` (`CreateCarrierDto { carrierNo, carrierType, carrierName?, capacity?, useYn?, remark? }`); `PUT /master/carriers/:carrierNo` (`UpdateCarrierDto`); `DELETE /master/carriers/:carrierNo`. `CarrierService.findByNo(carrierNo, company, plant): Promise<CarrierMaster | null>`, `normalizeCarrierNo(raw): string` (CarrierFlowService가 사용).

- [ ] **Step 1: 실패 테스트**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CarrierService } from './carrier.service';
import { CarrierMaster } from '../../../entities/carrier-master.entity';

const COMPANY = '40';
const PLANT = '1000';

describe('CarrierService', () => {
  let service: CarrierService;
  const repo = { findOne: jest.fn(), create: jest.fn((v) => v), save: jest.fn(async (v) => v), remove: jest.fn(), createQueryBuilder: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [CarrierService, { provide: getRepositoryToken(CarrierMaster), useValue: repo }],
    }).compile();
    service = module.get(CarrierService);
  });

  it('대차번호는 공백 제거·대문자로 저장한다', async () => {
    repo.findOne.mockResolvedValue(null);
    const saved = await service.create({ carrierNo: ' cr-001 ', carrierType: 'CART' }, COMPANY, PLANT, 'tester');
    expect(saved.carrierNo).toBe('CR-001');
    expect(saved.useYn).toBe('Y');
  });

  it('중복 대차번호는 409', async () => {
    repo.findOne.mockResolvedValue({ carrierNo: 'CR-001' });
    await expect(service.create({ carrierNo: 'CR-001', carrierType: 'CART' }, COMPANY, PLANT, 'tester')).rejects.toThrow(ConflictException);
  });

  it('수용량 0 이하는 400', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.create({ carrierNo: 'CR-002', carrierType: 'TRAY', capacity: 0 }, COMPANY, PLANT, 'tester')).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/master/services/carrier.service.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: DTO**

```ts
/**
 * @file carrier.dto.ts
 * @description 대차/트레이/매거진 마스터 DTO — 목록 필터/생성/수정
 */
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export const CARRIER_TYPES = ['CART', 'TRAY', 'MAGAZINE'] as const;

export class CreateCarrierDto {
  @ApiProperty({ description: '대차번호(바코드 값)', example: 'CR-001' })
  @IsString() @IsNotEmpty() @MaxLength(30)
  carrierNo: string;

  @ApiProperty({ description: '운반구 유형 (CARRIER_TYPE)', enum: CARRIER_TYPES })
  @IsString() @IsIn([...CARRIER_TYPES])
  carrierType: string;

  @ApiPropertyOptional({ description: '표시명' })
  @IsOptional() @IsString() @MaxLength(100)
  carrierName?: string | null;

  @ApiPropertyOptional({ description: '최대 적재 수 (비우면 무제한)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ description: '사용여부', default: 'Y' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string | null;
}

export class UpdateCarrierDto extends PartialType(OmitType(CreateCarrierDto, ['carrierNo'] as const)) {}

export class CarrierQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '유형 필터', enum: CARRIER_TYPES })
  @IsOptional() @IsIn([...CARRIER_TYPES])
  carrierType?: string;

  @ApiPropertyOptional({ description: '사용여부 필터' })
  @IsOptional() @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
```

- [ ] **Step 4: 서비스**

```ts
/**
 * @file carrier.service.ts
 * @description 대차 마스터 CRUD. 상태(EMPTY/LOADING/IN_TRANSIT)는 여기서 다루지 않는다 — production/CarrierFlowService가 라벨·LOT 테이블로 도출한다.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarrierMaster } from '../../../entities/carrier-master.entity';
import { CarrierQueryDto, CreateCarrierDto, UpdateCarrierDto } from '../dto/carrier.dto';

/** 대차번호 정규화 — 스캐너 입력과 마스터 저장값이 같아야 하므로 공백 제거 + 대문자 */
export function normalizeCarrierNo(raw: string): string {
  return raw.trim().toUpperCase();
}

@Injectable()
export class CarrierService {
  constructor(@InjectRepository(CarrierMaster) private readonly repo: Repository<CarrierMaster>) {}

  async findAll(query: CarrierQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, search, carrierType, useYn } = query;
    const qb = this.repo.createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant });
    if (carrierType) qb.andWhere('c.carrierType = :carrierType', { carrierType });
    if (useYn) qb.andWhere('c.useYn = :useYn', { useYn });
    if (search?.trim()) {
      qb.andWhere('(UPPER(c.carrierNo) LIKE :search OR UPPER(c.carrierName) LIKE :search)', { search: `%${search.trim().toUpperCase()}%` });
    }
    const [rows, total] = await qb.orderBy('c.carrierType', 'ASC').addOrderBy('c.carrierNo', 'ASC')
      .skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data: rows, total, page, limit };
  }

  async findByNo(carrierNo: string, company: string, plant: string): Promise<CarrierMaster | null> {
    return this.repo.findOne({ where: { company, plant, carrierNo: normalizeCarrierNo(carrierNo) } });
  }

  async findOneOrFail(carrierNo: string, company: string, plant: string): Promise<CarrierMaster> {
    const row = await this.findByNo(carrierNo, company, plant);
    if (!row) throw new NotFoundException(`대차를 찾을 수 없습니다: ${carrierNo}`);
    return row;
  }

  private assertCapacity(capacity: number | null | undefined): void {
    if (capacity != null && capacity <= 0) throw new BadRequestException('수용량은 1 이상이거나 비워 두어야 합니다.');
  }

  async create(dto: CreateCarrierDto, company: string, plant: string, userId: string) {
    const carrierNo = normalizeCarrierNo(dto.carrierNo);
    if (!carrierNo) throw new BadRequestException('대차번호는 필수입니다.');
    this.assertCapacity(dto.capacity);
    const existing = await this.repo.findOne({ where: { company, plant, carrierNo } });
    if (existing) throw new ConflictException(`이미 존재하는 대차번호입니다: ${carrierNo}`);
    const entity = this.repo.create({
      company, plant, carrierNo,
      carrierType: dto.carrierType,
      carrierName: dto.carrierName?.trim() || null,
      capacity: dto.capacity ?? null,
      useYn: dto.useYn ?? 'Y',
      remark: dto.remark ?? null,
      createdBy: userId, updatedBy: userId,
    });
    return this.repo.save(entity);
  }

  async update(carrierNo: string, dto: UpdateCarrierDto, company: string, plant: string, userId: string) {
    const row = await this.findOneOrFail(carrierNo, company, plant);
    this.assertCapacity(dto.capacity);
    Object.assign(row, {
      ...(dto.carrierType !== undefined ? { carrierType: dto.carrierType } : {}),
      ...(dto.carrierName !== undefined ? { carrierName: dto.carrierName?.trim() || null } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      updatedBy: userId,
    });
    return this.repo.save(row);
  }

  async delete(carrierNo: string, company: string, plant: string) {
    const row = await this.findOneOrFail(carrierNo, company, plant);
    await this.repo.remove(row);
    return { carrierNo: row.carrierNo, deleted: true };
  }
}
```

- [ ] **Step 5: 컨트롤러 (limit-sample.controller 패턴)**

```ts
/**
 * @file carrier.controller.ts
 * @description 대차/트레이/매거진 마스터 API
 * 1. GET    /master/carriers            — 목록(페이징·유형/사용여부/검색)
 * 2. GET    /master/carriers/:carrierNo — 단건
 * 3. POST   /master/carriers            — 생성
 * 4. PUT    /master/carriers/:carrierNo — 수정
 * 5. DELETE /master/carriers/:carrierNo — 삭제
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { CarrierService } from '../services/carrier.service';
import { CarrierQueryDto, CreateCarrierDto, UpdateCarrierDto } from '../dto/carrier.dto';

@ApiTags('기준정보 - 대차관리')
@Controller('master/carriers')
export class CarrierController {
  constructor(private readonly service: CarrierService) {}

  @Get()
  @ApiOperation({ summary: '대차 목록 조회' })
  async findAll(@Query() query: CarrierQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':carrierNo')
  @ApiOperation({ summary: '대차 단건 조회' })
  async findOne(@Param('carrierNo') carrierNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findOneOrFail(carrierNo, company, plant));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '대차 생성' })
  async create(@Body() dto: CreateCarrierDto, @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.create(dto, company, plant, req.user?.id ?? 'SYSTEM'), '대차가 등록되었습니다.');
  }

  @Put(':carrierNo')
  @ApiOperation({ summary: '대차 수정' })
  async update(@Param('carrierNo') carrierNo: string, @Body() dto: UpdateCarrierDto, @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.service.update(carrierNo, dto, company, plant, req.user?.id ?? 'SYSTEM'), '대차가 수정되었습니다.');
  }

  @Delete(':carrierNo')
  @ApiOperation({ summary: '대차 삭제' })
  async remove(@Param('carrierNo') carrierNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.delete(carrierNo, company, plant), '대차가 삭제되었습니다.');
  }
}
```
`master.module.ts`: controllers에 `CarrierController`, providers·exports에 `CarrierService`.

- [ ] **Step 6: 테스트·typecheck**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/master/services/carrier.service.spec.ts
pnpm.cmd run typecheck:backend
```
Expected: 3 passed, 오류 0.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/master/dto/carrier.dto.ts apps/backend/src/modules/master/services/carrier.service.ts apps/backend/src/modules/master/services/carrier.service.spec.ts apps/backend/src/modules/master/controllers/carrier.controller.ts apps/backend/src/modules/master/master.module.ts
git commit -F "$TEMP/cm.txt"   # "feat(master): 대차/트레이/매거진 마스터 API를 추가한다"
```

---

### Task 5: 메뉴 4곳·i18n 메뉴 라벨·라우팅 폼 체크박스

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts` (MASTER children `MST_VALIDATION` 뒤, PRODUCTION children `PROD_PRODUCT_TRANS` 뒤)
- Modify: `apps/backend/src/seeds/menu-config.json` (MASTER 배열 `"MST_VALIDATION"` 뒤, PRODUCTION 배열 `"PROD_PRODUCT_TRANS"` 뒤)
- Modify: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts` (MASTER 줄에 `'MST_CARRIER'`, PRODUCTION 줄에 `'PROD_CARRIER_STATUS'`)
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json` — `menu` 블록, `master.routing` 블록
- Modify: `apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx`, `RoutingFieldHelp.tsx`

**Interfaces:**
- Consumes: Task 3의 DTO 필드 `carrierLoadYn`, `carrierAutoInputYn`
- Produces: i18n 키 `menu.master.carrier`, `menu.production.carrierStatus`, `master.routing.carrierLoadYn`, `master.routing.carrierAutoInputYn`, `master.routing.carrierOn`, `master.routing.carrierOff`, `master.routing.carrierLoadShort`, `master.routing.carrierInputShort`

- [ ] **Step 1: 메뉴 3곳(코드) + i18n 메뉴 라벨**

menuConfig.ts:
```ts
      { code: "MST_CARRIER", labelKey: "menu.master.carrier", path: "/master/carrier" },
```
```ts
      { code: "PROD_CARRIER_STATUS", labelKey: "menu.production.carrierStatus", path: "/production/carrier-status" },
```
menu-config.json 두 배열, validator 두 줄에 코드 추가. 로케일 `menu` 블록(`"master.limitSample"` 줄 근처, `"production.inputKiosk"` 줄 근처):

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| `menu.master.carrier` | 대차관리 | Carrier Master | 台车管理 | Quản lý xe đẩy |
| `menu.production.carrierStatus` | 대차현황 | Carrier Status | 台车状态 | Tình trạng xe đẩy |

메뉴 로케일 커버리지 테스트로 검증:
```powershell
node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs
```
Expected: pass.

- [ ] **Step 2: 라우팅 폼 체크박스 2개**

`RoutingGroupManager.tsx` `EMPTY_PROCESS`에 `carrierLoadYn: "N", carrierAutoInputYn: "N",` 추가. 편집 로드(L349 부근 `issueLabelType: process.issueLabelType || "NONE",` 아래)에 `carrierLoadYn: process.carrierLoadYn || "N", carrierAutoInputYn: process.carrierAutoInputYn || "N",`, 저장 body(L373 부근)에 같은 두 줄. 라벨발행 select 블록 바로 아래에 추가:

```tsx
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel field="carrierLoadYn" label={t("master.routing.carrierLoadYn", "대차 적재(출력측)")} />
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="routing-carrier-load"
                  checked={processForm.carrierLoadYn === "Y"}
                  disabled={!processForm.issueLabelType || processForm.issueLabelType === "NONE"}
                  onChange={(e) => setProcessForm((f) => ({ ...f, carrierLoadYn: e.target.checked ? "Y" : "N" }))}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">
                  {processForm.carrierLoadYn === "Y" ? t("master.routing.carrierOn", "사용") : t("master.routing.carrierOff", "미사용")}
                </span>
              </label>
            </div>
            <div>
              <FieldLabel field="carrierAutoInputYn" label={t("master.routing.carrierAutoInputYn", "대차 자동투입(입력측)")} />
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="routing-carrier-input"
                  checked={processForm.carrierAutoInputYn === "Y"}
                  onChange={(e) => setProcessForm((f) => ({ ...f, carrierAutoInputYn: e.target.checked ? "Y" : "N" }))}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">
                  {processForm.carrierAutoInputYn === "Y" ? t("master.routing.carrierOn", "사용") : t("master.routing.carrierOff", "미사용")}
                </span>
              </label>
            </div>
          </div>
```
라벨유형이 NONE으로 바뀌면 적재 플래그를 끈다: 라벨발행 select의 onChange를 `setProcessForm((f) => ({ ...f, issueLabelType: e.target.value, carrierLoadYn: e.target.value === "NONE" ? "N" : f.carrierLoadYn }))`로 변경.

공정 목록 라벨 배지 셀(`process.issueLabelType === 'FG'` 배지 뒤)에 텍스트/테두리 배지 추가(파스텔 배경 금지):
```tsx
                          {process.carrierLoadYn === 'Y' && (
                            <span className="inline-flex items-center rounded border border-primary px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              {t("master.routing.carrierLoadShort", "대차↑")}
                            </span>
                          )}
                          {process.carrierAutoInputYn === 'Y' && (
                            <span className="inline-flex items-center rounded border border-primary px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              {t("master.routing.carrierInputShort", "대차↓")}
                            </span>
                          )}
```
`RoutingFieldHelp.tsx` `ROUTING_FIELD_HELP`에:
```ts
  carrierLoadYn: { db: "ROUTING_PROCESSES.CARRIER_LOAD_YN", description: "이 공정 실적으로 발행된 라벨을 스캔한 출력 대차에 담습니다. 라벨 발행 공정에서만 켤 수 있고, 켜면 출력 대차 없이는 실적을 저장할 수 없습니다." },
  carrierAutoInputYn: { db: "ROUTING_PROCESSES.CARRIER_AUTO_INPUT_YN", description: "이 공정에서 대차를 스캔하면 담긴 라벨/LOT 전부를 자동으로 투입(장착)합니다. 중간 공정은 적재와 자동투입을 모두 켭니다." },
```
로케일 `master.routing` 블록(4개 파일):

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| carrierLoadYn | 대차 적재(출력측) | Carrier load (output) | 台车装载(输出) | Xếp xe đẩy (đầu ra) |
| carrierAutoInputYn | 대차 자동투입(입력측) | Carrier auto-input | 台车自动投入(输入) | Tự động nạp từ xe đẩy |
| carrierOn | 사용 | On | 使用 | Bật |
| carrierOff | 미사용 | Off | 不使用 | Tắt |
| carrierLoadShort | 대차↑ | Cart↑ | 台车↑ | Xe↑ |
| carrierInputShort | 대차↓ | Cart↓ | 台车↓ | Xe↓ |

- [ ] **Step 3: 검증**

```powershell
pnpm.cmd run typecheck:frontend
node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs
```
Expected: 오류 0, pass. 4개 로케일에 새 키가 있는지 `Grep`으로 확인(`carrierAutoInputYn` 4파일).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/config/menuConfig.ts apps/backend/src/seeds/menu-config.json apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json "apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx" "apps/frontend/src/app/(authenticated)/master/routing/components/RoutingFieldHelp.tsx"
git commit -F "$TEMP/cm.txt"   # "feat(routing,menu): 라우팅 공정에 대차 적재·자동투입 체크박스를 두고 대차 메뉴 2개를 등록한다"
```

---

### Task 6: 대차 마스터 화면 `/master/carrier`

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/carrier/page.tsx`, `carrierColumns.tsx`, `CarrierFormPanel.tsx`, `CarrierLabelModal.tsx`
- Test: `apps/frontend/src/app/(authenticated)/master/carrier/carrier.structure.test.mjs`
- Modify: 로케일 4개 — `master.carrier` 블록 신규

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /master/carriers` (Task 4)
- Produces: `CarrierRow { carrierNo, carrierType, carrierName, capacity, useYn, remark, updatedAt }`, `createCarrierGridColumns({ t, onEdit, onDelete, onPrintLabel }): ColumnDef<CarrierRow>[]`, `CarrierForm { carrierNo, carrierType, carrierName, capacity, useYn, remark }`

- [ ] **Step 1: 구조 테스트 작성(실패)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./carrierColumns.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./CarrierFormPanel.tsx', import.meta.url), 'utf8');
const label = readFileSync(new URL('./CarrierLabelModal.tsx', import.meta.url), 'utf8');
const locales = ['ko', 'en', 'zh', 'vi'].map((lang) => ({
  lang,
  json: JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8')),
}));

test('/master/carrier keeps page thin: columns/panel/label are separate files', () => {
  assert.match(columns, /export function createCarrierGridColumns\(/);
  assert.match(columns, /\): ColumnDef<CarrierRow>\[\]/);
  assert.match(page, /from "\.\/carrierColumns"/);
  assert.match(page, /from "\.\/CarrierFormPanel"/);
  assert.match(page, /from "\.\/CarrierLabelModal"/);
  assert.doesNotMatch(page, /accessorKey:/);
});

test('coded values use shared selects and badges', () => {
  assert.match(panel, /<ComCodeSelect groupCode="CARRIER_TYPE"/);
  assert.match(panel, /<UseYnSelect/);
  assert.match(columns, /<ComCodeBadge groupCode="CARRIER_TYPE"/);
  assert.match(page, /ServerPager/);
});

test('right-side panel follows master panel standard (top actions, data swap, unsaved guard)', () => {
  assert.match(page, /useUnsavedGuard/);
  assert.match(page, /markDirty\(dirty\)/);
  assert.match(page, /initialFormRef\.current = next/);
  assert.doesNotMatch(page, /<CarrierFormPanel[^>]*\skey=/);
  assert.match(panel, /animate-slide-in-right/);
  const headerBlock = panel.slice(panel.indexOf('border-b border-border'), panel.indexOf('overflow-y-auto'));
  assert.match(headerBlock, /onClick=\{onCancel\}/);
  assert.match(headerBlock, /onClick=\{onSave\}/);
});

test('label modal prints QR of carrierNo only (kiosk scans the raw number)', () => {
  assert.match(label, /<QRCode value=\{carrier\.carrierNo\}/);
  assert.match(label, /window\.print\(\)/);
  assert.match(label, /@page \{ size: 60mm 55mm/);
});

test('no pastel backgrounds, no alert/confirm', () => {
  for (const src of [page, columns, panel, label]) {
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-(?:50|100)\b/);
    assert.doesNotMatch(src, /\balert\(|\bconfirm\(/);
  }
});

test('i18n master.carrier keys exist in 4 locales', () => {
  const keys = ['title', 'subtitle', 'carrierNo', 'carrierType', 'carrierName', 'capacity', 'capacityUnlimited', 'searchPlaceholder', 'qrLabelTitle', 'qrLabelHeader'];
  for (const { lang, json } of locales) {
    for (const k of keys) assert.ok(json.master?.carrier?.[k], `${lang}: master.carrier.${k} 누락`);
  }
});
```

- [ ] **Step 2: 실행해 실패 확인**

```powershell
node --test "apps/frontend/src/app/(authenticated)/master/carrier/carrier.structure.test.mjs"
```
Expected: FAIL (파일 없음).

- [ ] **Step 3: 컬럼 파일**

```tsx
"use client";
/**
 * @file src/app/(authenticated)/master/carrier/carrierColumns.tsx
 * @description 대차 마스터 DataGrid 컬럼 팩토리. 유형은 ComCodeBadge(CARRIER_TYPE), 수용량 NULL은 "무제한" 표기.
 */
import type { TFunction } from "i18next";
import { Edit2, Printer, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface CarrierRow {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  useYn: string;
  remark: string | null;
  updatedAt: string;
}

interface Options {
  t: TFunction;
  onEdit: (row: CarrierRow) => void;
  onDelete: (row: CarrierRow) => void;
  onPrintLabel: (row: CarrierRow) => void;
}

export function createCarrierGridColumns({ t, onEdit, onDelete, onPrintLabel }: Options): ColumnDef<CarrierRow>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 110, meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button type="button" onClick={() => onEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button type="button" onClick={() => onPrintLabel(row.original)} className="p-1 hover:bg-surface rounded" title={t("master.carrier.qrLabelTitle")} data-testid="carrier-label-open">
            <Printer className="w-4 h-4 text-text-muted" />
          </button>
          <button type="button" onClick={() => onDelete(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "carrierNo", header: t("master.carrier.carrierNo"), size: 140, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono font-medium text-primary">{getValue() as string}</span>,
    },
    {
      accessorKey: "carrierType",
      header: () => <StatusHeaderHelp label={t("master.carrier.carrierType")} codeType="CARRIER_TYPE" align="center" />,
      size: 110, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CARRIER_TYPE" code={getValue() as string} />,
    },
    { accessorKey: "carrierName", header: t("master.carrier.carrierName"), size: 180, meta: { filterType: "text" as const } },
    {
      accessorKey: "capacity", header: t("master.carrier.capacity"), size: 90, meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="tabular-nums">{v == null ? t("master.carrier.capacityUnlimited") : v.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "useYn", header: t("common.useYn"), size: 80, meta: { align: "center" as const },
      cell: ({ getValue }) => <span className={(getValue() as string) === "Y" ? "text-green-600 dark:text-green-400 font-semibold" : "text-text-muted"}>{getValue() as string}</span>,
    },
    { accessorKey: "remark", header: t("common.remark"), size: 200 },
  ];
}
```

- [ ] **Step 4: 폼 패널 (LimitSampleFormPanel 축약형)**

```tsx
"use client";
/**
 * @file src/app/(authenticated)/master/carrier/CarrierFormPanel.tsx
 * @description 대차 등록/수정 우측 슬라이드 패널 — 액션 버튼 상단. 폼 상태·저장은 page.tsx 소유.
 */
import type { TFunction } from "i18next";
import { Button, Input } from "@/components/ui";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";

export interface CarrierForm {
  carrierNo: string;
  carrierType: string;
  carrierName: string;
  capacity: string;
  useYn: string;
  remark: string;
}

export const emptyCarrierForm = (): CarrierForm => ({
  carrierNo: "", carrierType: "CART", carrierName: "", capacity: "", useYn: "Y", remark: "",
});

/** 저장 가능: 번호·유형 필수, 수용량은 비었거나 1 이상 정수 */
export function validateCarrierForm(form: CarrierForm): boolean {
  if (!form.carrierNo.trim() || !form.carrierType) return false;
  if (form.capacity.trim() !== "" && !(Number.isInteger(Number(form.capacity)) && Number(form.capacity) >= 1)) return false;
  return true;
}

interface Props {
  t: TFunction;
  editing: boolean;
  saving: boolean;
  form: CarrierForm;
  onChange: (key: keyof CarrierForm, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function CarrierFormPanel({ t, editing, saving, form, onChange, onSave, onCancel }: Props) {
  const canSave = !saving && validateCarrierForm(form);
  return (
    <div className="w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{editing ? t("common.edit") : t("common.add")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={onSave} disabled={!canSave}>{saving ? t("common.saving", "저장 중") : t("common.save")}</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("master.carrier.carrierNo")} value={form.carrierNo}
            onChange={e => onChange("carrierNo", e.target.value.toUpperCase())} disabled={editing} fullWidth required />
          <ComCodeSelect groupCode="CARRIER_TYPE" includeAll={false} label={t("master.carrier.carrierType")}
            value={form.carrierType} onChange={v => onChange("carrierType", v)} fullWidth required />
          <div className="col-span-2">
            <Input label={t("master.carrier.carrierName")} value={form.carrierName}
              onChange={e => onChange("carrierName", e.target.value)} fullWidth />
          </div>
          <Input label={t("master.carrier.capacity")} type="number" min={1} value={form.capacity}
            placeholder={t("master.carrier.capacityUnlimited")}
            onChange={e => onChange("capacity", e.target.value)} fullWidth />
          <UseYnSelect includeAll={false} label={t("common.useYn")} value={form.useYn} onChange={v => onChange("useYn", v)} fullWidth />
          <div className="col-span-2">
            <Input label={t("common.remark")} value={form.remark} onChange={e => onChange("remark", e.target.value)} fullWidth />
          </div>
          <p className="col-span-2 text-text-muted">{t("master.carrier.capacityHint")}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: QR 라벨 모달 (EquipLabelModal 패턴)**

```tsx
"use client";
/**
 * @file src/app/(authenticated)/master/carrier/CarrierLabelModal.tsx
 * @description 대차 QR 라벨 — QR 값은 대차번호 그대로(현장 화면이 carrierNo로 매칭). window.print + 60x55mm.
 */
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import QRCode from "react-qr-code";
import { Modal, Button, ComCodeBadge } from "@/components/ui";
import type { CarrierRow } from "./carrierColumns";

interface Props { isOpen: boolean; carrier: CarrierRow | null; onClose: () => void; }

export default function CarrierLabelModal({ isOpen, carrier, onClose }: Props) {
  const { t } = useTranslation();
  const handlePrint = () => window.print();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("master.carrier.qrLabelTitle", "대차 QR 라벨")} size="md">
      <div className="flex justify-end mb-3 print:hidden">
        <Button onClick={handlePrint} disabled={!carrier} data-testid="carrier-label-print">
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>
      {carrier && (
        <div id="carrier-label-area" className="mx-auto bg-white text-black border-2 border-black rounded p-3 flex flex-col items-center gap-2" style={{ width: 300 }}>
          <div className="self-start text-[11px] font-semibold tracking-wide">{t("master.carrier.qrLabelHeader", "대차")}</div>
          <QRCode value={carrier.carrierNo} size={128} />
          <div className="font-mono text-base font-bold mt-1">{carrier.carrierNo}</div>
          <div className="text-center text-sm font-semibold leading-tight">{carrier.carrierName ?? ""}</div>
          <div className="print:hidden"><ComCodeBadge groupCode="CARRIER_TYPE" code={carrier.carrierType} /></div>
          <div className="text-[11px] text-gray-700">
            {carrier.capacity == null ? t("master.carrier.capacityUnlimited") : `${t("master.carrier.capacity")} ${carrier.capacity}`}
          </div>
        </div>
      )}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #carrier-label-area, #carrier-label-area * { visibility: visible; }
          #carrier-label-area { position: absolute; top: 0; left: 0; border: none !important; width: auto; }
          @page { size: 60mm 55mm; margin: 3mm; }
        }
      `}</style>
    </Modal>
  );
}
```

- [ ] **Step 6: 페이지 (limit-sample page 축약형, 사진 없음)**

`page.tsx`는 limit-sample page.tsx와 같은 뼈대로 작성한다. 다른 점만 적는다.
- 상태: `rows/total/page/loading/saving/searchText/typeFilter/useYnFilter("Y")/panelOpen/editing/selectedRow/deleteTarget/labelTarget/form/initialFormRef`, `const { markDirty, guard, guardModalProps } = useUnsavedGuard();`, `const PAGE_SIZE = 50;`
- `fetchData`: `api.get("/master/carriers", { params: { page, limit: PAGE_SIZE, ...(searchText.trim() && { search }), ...(typeFilter && { carrierType: typeFilter }), ...(useYnFilter && { useYn: useYnFilter }) } })`, `setRows(res.data?.data ?? [])`, `setTotal(Number(res.data?.meta?.total ?? 0))`.
- `openEdit(row)`: `const next: CarrierForm = { carrierNo: row.carrierNo, carrierType: row.carrierType, carrierName: row.carrierName ?? "", capacity: row.capacity == null ? "" : String(row.capacity), useYn: row.useYn || "Y", remark: row.remark ?? "" }; setForm(next); initialFormRef.current = next; setEditing(row); setSelectedRow(row); setPanelOpen(true);`
- `dirty = panelOpen && JSON.stringify(form) !== JSON.stringify(initialFormRef.current)`; `useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);`
- `handleSave`: payload `{ carrierNo: form.carrierNo.trim().toUpperCase(), carrierType: form.carrierType, carrierName: form.carrierName.trim() || null, capacity: form.capacity.trim() === "" ? null : Number(form.capacity), useYn: form.useYn, remark: form.remark.trim() || null }`; editing이면 `api.put(\`/master/carriers/${encodeURIComponent(editing.carrierNo)}\`, payload)` 아니면 `api.post("/master/carriers", payload)`; 성공 시 `fetchData()` 후 `closePanel()`.
- `handleDeleteConfirm`: `api.delete(\`/master/carriers/${encodeURIComponent(deleteTarget.carrierNo)}\`)`.
- 컬럼: `createCarrierGridColumns({ t, onEdit: (row) => guard(() => openEdit(row)), onDelete: setDeleteTarget, onPrintLabel: setLabelTarget })`.
- 헤더 제목 아이콘 `ShoppingCart`(lucide), `t("master.carrier.title")`/`t("master.carrier.subtitle")`. 툴바: 검색 `Input`(placeholder `master.carrier.searchPlaceholder`), `<ComCodeSelect groupCode="CARRIER_TYPE" value={typeFilter} onChange={setTypeFilter} labelPrefix={t("master.carrier.carrierType")} />`, `<UseYnSelect value={useYnFilter} onChange={setUseYnFilter} />`, `<ServerPager page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={loading} className="flex-shrink-0 ml-auto" />`.
- DataGrid `getRowId={(row) => (row as CarrierRow).carrierNo}`, `sqlQuery` 문자열은 `SELECT * FROM CARRIER_MASTERS WHERE COMPANY = '40' AND PLANT_CD = '1000' ORDER BY CARRIER_TYPE, CARRIER_NO`.
- 하단: `{panelOpen && <CarrierFormPanel t={t} editing={!!editing} saving={saving} form={form} onChange={setField} onSave={handleSave} onCancel={() => guard(closePanel)} />}`, `<CarrierLabelModal isOpen={!!labelTarget} carrier={labelTarget} onClose={() => setLabelTarget(null)} />`, `<ConfirmModal {...guardModalProps} />`, 삭제 ConfirmModal(variant danger, message `\`'${deleteTarget?.carrierNo ?? ""}'${t("common.deleteConfirm")}\``).

- [ ] **Step 7: i18n `master.carrier` 블록 (4개 파일, `master.limitSample` 블록 옆)**

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| title | 대차관리 | Carrier Master | 台车管理 | Quản lý xe đẩy |
| subtitle | 대차·트레이·매거진을 등록하고 QR 라벨을 출력합니다. | Register carts, trays and magazines and print QR labels. | 登记台车、托盘、料盒并打印二维码标签。 | Đăng ký xe đẩy, khay, magazine và in nhãn QR. |
| carrierNo | 대차번호 | Carrier No. | 台车编号 | Số xe đẩy |
| carrierType | 유형 | Type | 类型 | Loại |
| carrierName | 이름 | Name | 名称 | Tên |
| capacity | 수용량 | Capacity | 容量 | Sức chứa |
| capacityUnlimited | 무제한 | Unlimited | 不限 | Không giới hạn |
| capacityHint | 수용량을 비우면 무제한입니다. 값이 있으면 가득 찼을 때 실적 저장이 막힙니다. | Leave capacity empty for unlimited. If set, saving results is blocked when full. | 容量留空表示不限。设置后装满时将阻止保存实绩。 | Để trống sức chứa nghĩa là không giới hạn. Nếu đặt, khi đầy sẽ chặn lưu kết quả. |
| searchPlaceholder | 대차번호·이름 검색 | Search carrier no. or name | 搜索台车编号/名称 | Tìm số xe đẩy hoặc tên |
| qrLabelTitle | 대차 QR 라벨 | Carrier QR Label | 台车二维码标签 | Nhãn QR xe đẩy |
| qrLabelHeader | 대차 | CARRIER | 台车 | XE ĐẨY |

- [ ] **Step 8: 검증**

```powershell
node --test "apps/frontend/src/app/(authenticated)/master/carrier/carrier.structure.test.mjs"
pnpm.cmd run typecheck:frontend
```
Expected: 6 pass, 오류 0. 브라우저(claude-in-chrome)로 `http://localhost:3002/master/carrier` 열어 등록 1건(CR-001, CART, 수용량 비움)·수정·라벨 모달 확인. 대차현황 화면은 3단계에서 만드므로 메뉴는 등록됐지만 404가 정상이다.

- [ ] **Step 9: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/master/carrier/page.tsx" "apps/frontend/src/app/(authenticated)/master/carrier/carrierColumns.tsx" "apps/frontend/src/app/(authenticated)/master/carrier/CarrierFormPanel.tsx" "apps/frontend/src/app/(authenticated)/master/carrier/CarrierLabelModal.tsx" "apps/frontend/src/app/(authenticated)/master/carrier/carrier.structure.test.mjs" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F "$TEMP/cm.txt"   # "feat(master): 대차관리 화면과 QR 라벨 출력을 추가한다"
```

---

## 2단계 — 출력측 적재·이동전표

### Task 7: CarrierFlow 규칙·서비스·컨트롤러

**Files:**
- Create: `apps/backend/src/modules/production/services/carrier-flow.rules.ts`, `carrier-flow.service.ts`, `controllers/carrier-flow.controller.ts`, `dto/carrier-flow.dto.ts`
- Test: `apps/backend/src/modules/production/services/carrier-flow.rules.spec.ts`, `carrier-flow.service.spec.ts`
- Modify: `apps/backend/src/modules/production/production.module.ts` (controllers·providers·exports 추가, `MasterModule` import는 이미 있으면 `CarrierService` export를 쓰고 없으면 `CarrierMaster` 리포지토리를 직접 주입)

**Interfaces:**
- Produces (rules):
  - `type CarrierContentKind = 'SG' | 'FG' | 'MAT'`
  - `interface CarrierContentRow { kind: CarrierContentKind; barcode: string; itemCode: string; itemName: string | null; orderNo: string | null; qty: number; loadedAt: Date | null; slipNo: string | null; issueProcessCode: string | null }`
  - `type CarrierStatus = 'EMPTY' | 'LOADING' | 'IN_TRANSIT'`
  - `deriveCarrierStatus(rows: CarrierContentRow[]): CarrierStatus`
  - `assertCanLoad(input: { rows: CarrierContentRow[]; kind: CarrierContentKind; itemCode: string; orderNo: string | null; addCount: number; capacity: number | null }): void` — 규칙: 전표 있으면 400 "이동전표가 발행된 대차입니다", 종류 불일치 400 "라벨과 원자재를 한 대차에 섞을 수 없습니다", kind≠'MAT'일 때 품목/지시 불일치 400, 수용량 초과 400 "대차 교체"
  - `assertCanAutoInput(input: { rows: CarrierContentRow[]; autoInputYn: string }): void` — N이면 400, 0건이면 400 "빈 대차", kind≠'MAT'인데 slipNo 없으면 400 "이동전표 미발행 대차"
- Produces (service, 모두 `(…, company, plant)`):
  - `getContents(carrierNo): Promise<CarrierContentRow[]>` (UNION ALL 3테이블, `carrierNo` 정규화)
  - `getStatus(carrierNo): Promise<CarrierStatusView>` where `CarrierStatusView { carrierNo, carrierType, carrierName, capacity, status, kind: CarrierContentKind|null, itemCode, itemName, orderNo, loadedCount, totalQty, slipNo, loadProcessCode, nextProcessCode, nextProcessName, contents }`
  - `getProcessFlags(orderNo, processCode): Promise<{ carrierLoadYn, carrierAutoInputYn, issueLabelType }>`
  - `select(carrierNo, equipCode): Promise<CarrierStatusView>` (검증 후 `EQUIP_MASTERS.CUR_CARRIER_NO` 갱신)
  - `release(equipCode): Promise<void>` (CUR_CARRIER_NO NULL)
  - `issueSlip(carrierNo, userId): Promise<CarrierSlipView>` where `CarrierSlipView extends CarrierStatusView { slipNo, issuedAt, issuedBy, reprint: boolean, fromProcessCode, fromProcessName, toProcessCode, toProcessName }`
  - `getAutoInputRows(carrierNo, equipCode): Promise<{ kind, rows: CarrierContentRow[] }>`
  - `list(query): Promise<{ data: CarrierListRow[]; total; page; limit }>`
  - `stampInTx(qr, kind, barcodes: string[], carrierNo, company, plant): Promise<void>` / `clearInTx(qr, kind, barcodes, company, plant): Promise<void>` — 다른 서비스가 같은 트랜잭션에서 호출
  - `assertLoadableInTx(qr, { carrierNo, kind, itemCode, orderNo, addCount, company, plant }): Promise<void>` — 실적/확정 서비스가 호출
- Produces (HTTP): `GET /production/carriers`, `GET /production/carriers/process-flags?orderNo&processCode`, `GET /production/carriers/:no`, `POST /production/carriers/:no/select {equipCode}`, `POST /production/carriers/release {equipCode}`, `POST /production/carriers/:no/slip`, `GET /production/carriers/:no/auto-input?equipCode`

- [ ] **Step 1: 규칙 테스트(실패)**

```ts
import { BadRequestException } from '@nestjs/common';
import { assertCanAutoInput, assertCanLoad, deriveCarrierStatus, type CarrierContentRow } from './carrier-flow.rules';

const sg = (over: Partial<CarrierContentRow> = {}): CarrierContentRow => ({
  kind: 'SG', barcode: 'SG260919-00001', itemCode: 'SFG-1', itemName: null, orderNo: 'W1',
  qty: 10, loadedAt: new Date(), slipNo: null, issueProcessCode: 'P10', ...over,
});
const mat = (over: Partial<CarrierContentRow> = {}): CarrierContentRow => ({
  kind: 'MAT', barcode: 'VH1-RM26091900001', itemCode: 'RM-1', itemName: null, orderNo: null,
  qty: 100, loadedAt: new Date(), slipNo: null, issueProcessCode: null, ...over,
});

describe('deriveCarrierStatus', () => {
  it('0건=EMPTY, 전표 없음=LOADING, 전표 있음=IN_TRANSIT', () => {
    expect(deriveCarrierStatus([])).toBe('EMPTY');
    expect(deriveCarrierStatus([sg()])).toBe('LOADING');
    expect(deriveCarrierStatus([sg({ slipNo: 'CS260919-00001' })])).toBe('IN_TRANSIT');
  });
});

describe('assertCanLoad', () => {
  const base = { kind: 'SG' as const, itemCode: 'SFG-1', orderNo: 'W1', addCount: 1, capacity: null };
  it('빈 대차는 담을 수 있다', () => {
    expect(() => assertCanLoad({ ...base, rows: [] })).not.toThrow();
  });
  it('전표 발행 대차는 추가 적재 불가', () => {
    expect(() => assertCanLoad({ ...base, rows: [sg({ slipNo: 'CS1' })] })).toThrow(/이동전표/);
  });
  it('생산 대차는 품목·작업지시가 같아야 한다', () => {
    expect(() => assertCanLoad({ ...base, rows: [sg({ itemCode: 'SFG-2' })] })).toThrow(/품목/);
    expect(() => assertCanLoad({ ...base, rows: [sg({ orderNo: 'W2' })] })).toThrow(/작업지시/);
  });
  it('원자재 대차는 품목이 섞여도 되지만 라벨과는 섞을 수 없다', () => {
    expect(() => assertCanLoad({ ...base, kind: 'MAT', itemCode: 'RM-9', orderNo: null, rows: [mat()] })).not.toThrow();
    expect(() => assertCanLoad({ ...base, kind: 'MAT', rows: [sg()] })).toThrow(/섞을/);
  });
  it('수용량 초과는 대차 교체 안내', () => {
    expect(() => assertCanLoad({ ...base, capacity: 2, addCount: 2, rows: [sg()] })).toThrow(/대차 교체/);
    expect(() => assertCanLoad({ ...base, capacity: 2, addCount: 1, rows: [sg()] })).not.toThrow();
  });
});

describe('assertCanAutoInput', () => {
  it('옵션 N이면 거부', () => {
    expect(() => assertCanAutoInput({ rows: [sg({ slipNo: 'CS1' })], autoInputYn: 'N' })).toThrow(/자동투입/);
  });
  it('빈 대차 거부', () => {
    expect(() => assertCanAutoInput({ rows: [], autoInputYn: 'Y' })).toThrow(/빈 대차/);
  });
  it('생산 대차는 전표 필수, 원자재 대차는 전표 없이 허용', () => {
    expect(() => assertCanAutoInput({ rows: [sg()], autoInputYn: 'Y' })).toThrow(/이동전표 미발행/);
    expect(() => assertCanAutoInput({ rows: [sg({ slipNo: 'CS1' })], autoInputYn: 'Y' })).not.toThrow();
    expect(() => assertCanAutoInput({ rows: [mat()], autoInputYn: 'Y' })).not.toThrow();
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-flow.rules.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: 규칙 구현**

```ts
/**
 * @file carrier-flow.rules.ts
 * @description 대차 흐름 순수 규칙 — 상태 도출, 적재 가능 판정, 자동투입 가능 판정. DB를 모른다.
 *
 * 초보자 가이드:
 * 1. 대차의 진실은 SG_LABELS/FG_LABELS/MAT_LOTS.CARRIER_NO다. 이 파일은 그 행들의 배열(CarrierContentRow[])만 받는다.
 * 2. 생산 대차(SG/FG)는 품목 하나·작업지시 하나·전표 발행 후 잠금·자동투입은 전표 필수.
 *    원자재 대차(MAT)는 키팅이라 품목 혼적 허용, 전표 없이도 자동 장착 허용(설계 12절, 강제하지 않는다).
 * 3. 라벨과 원자재는 한 대차에 섞지 않는다.
 */
import { BadRequestException } from '@nestjs/common';

export type CarrierContentKind = 'SG' | 'FG' | 'MAT';
export type CarrierStatus = 'EMPTY' | 'LOADING' | 'IN_TRANSIT';

export interface CarrierContentRow {
  kind: CarrierContentKind;
  barcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  qty: number;
  loadedAt: Date | null;
  slipNo: string | null;
  issueProcessCode: string | null;
}

export function deriveCarrierStatus(rows: CarrierContentRow[]): CarrierStatus {
  if (rows.length === 0) return 'EMPTY';
  return rows.some((r) => r.slipNo) ? 'IN_TRANSIT' : 'LOADING';
}

/** 담긴 내용의 종류. 라벨(SG/FG)은 생산 대차로 묶고 MAT는 원자재 대차 */
export function carrierKindOf(rows: CarrierContentRow[]): CarrierContentKind | null {
  return rows[0]?.kind ?? null;
}

export function isProductionKind(kind: CarrierContentKind | null): boolean {
  return kind === 'SG' || kind === 'FG';
}

export function assertCanLoad(input: {
  rows: CarrierContentRow[];
  kind: CarrierContentKind;
  itemCode: string;
  orderNo: string | null;
  addCount: number;
  capacity: number | null;
}): void {
  const { rows, kind, itemCode, orderNo, addCount, capacity } = input;
  if (deriveCarrierStatus(rows) === 'IN_TRANSIT') {
    throw new BadRequestException('이동전표가 발행된 대차입니다. 비워진 뒤에 다시 쓰세요.');
  }
  const existingKind = carrierKindOf(rows);
  if (existingKind && isProductionKind(existingKind) !== isProductionKind(kind)) {
    throw new BadRequestException('라벨과 원자재를 한 대차에 섞을 수 없습니다.');
  }
  if (isProductionKind(kind) && rows.length > 0) {
    const head = rows[0];
    if (head.itemCode !== itemCode) {
      throw new BadRequestException(`대차에 다른 품목이 담겨 있습니다: ${head.itemCode}`);
    }
    if ((head.orderNo ?? null) !== (orderNo ?? null)) {
      throw new BadRequestException(`대차에 다른 작업지시분이 담겨 있습니다: ${head.orderNo ?? '-'}`);
    }
  }
  if (capacity != null && rows.length + addCount > capacity) {
    throw new BadRequestException(`대차 교체: 수용량 ${capacity}을(를) 초과합니다 (현재 ${rows.length}, 추가 ${addCount}).`);
  }
}

export function assertCanAutoInput(input: { rows: CarrierContentRow[]; autoInputYn: string }): void {
  const { rows, autoInputYn } = input;
  if (autoInputYn !== 'Y') {
    throw new BadRequestException('이 공정은 대차 자동투입을 쓰지 않습니다.');
  }
  if (rows.length === 0) {
    throw new BadRequestException('빈 대차입니다.');
  }
  if (isProductionKind(carrierKindOf(rows)) && !rows.some((r) => r.slipNo)) {
    throw new BadRequestException('이동전표 미발행 대차입니다. 이전 공정에서 이동전표를 발행하세요.');
  }
}
```

- [ ] **Step 4: 규칙 테스트 통과 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-flow.rules.spec.ts
```
Expected: 8 passed.

- [ ] **Step 5: DTO**

```ts
/**
 * @file carrier-flow.dto.ts
 * @description 대차 흐름 API DTO — 출력 대차 지정/해제, 현황 목록 필터, 자동투입 조회
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class SelectCarrierDto {
  @ApiProperty({ description: '출력 대차를 지정할 설비코드' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  equipCode: string;
}

export class ReleaseCarrierDto extends SelectCarrierDto {}

export class CarrierAutoInputQueryDto {
  @ApiProperty({ description: '투입할 설비코드 (설비 공정의 CARRIER_AUTO_INPUT_YN 검사)' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  equipCode: string;
}

export class CarrierProcessFlagsQueryDto {
  @ApiProperty({ description: '작업지시번호 (라우팅 도출)' })
  @IsString() @IsNotEmpty()
  orderNo: string;

  @ApiProperty({ description: '공정코드' })
  @IsString() @IsNotEmpty()
  processCode: string;
}

export class CarrierListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '도출 상태 필터', enum: ['EMPTY', 'LOADING', 'IN_TRANSIT', 'ACTIVE'] })
  @IsOptional() @IsIn(['EMPTY', 'LOADING', 'IN_TRANSIT', 'ACTIVE'])
  carrierStatus?: string;

  @ApiPropertyOptional({ description: '적재 공정코드 필터' })
  @IsOptional() @IsString()
  processCode?: string;

  @ApiPropertyOptional({ description: '바코드로 대차 찾기 (SG/FG/LOT 바코드)' })
  @IsOptional() @IsString()
  barcode?: string;
}
```

- [ ] **Step 6: 서비스 spec(실패) — select·slip·auto-input 핵심 3건**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CarrierFlowService } from './carrier-flow.service';
import { CarrierMaster } from '../../../entities/carrier-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

const COMPANY = '40';
const PLANT = '1000';

describe('CarrierFlowService', () => {
  let service: CarrierFlowService;
  const carrierRepo = { findOne: jest.fn() };
  const equipRepo = { findOne: jest.fn(), update: jest.fn() };
  const jobOrderRepo = { findOne: jest.fn() };
  const routingRepo = { findOne: jest.fn(), find: jest.fn() };
  const itemRepo = { find: jest.fn().mockResolvedValue([]) };
  const manager = { query: jest.fn(), update: jest.fn(), findOne: jest.fn() };
  const tx = { run: jest.fn(async (cb: (qr: unknown) => Promise<unknown>) => cb({ manager })) };
  const numbering = { nextCarrierSlipNo: jest.fn().mockResolvedValue('CS260919-00001') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CarrierFlowService,
        { provide: getRepositoryToken(CarrierMaster), useValue: carrierRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: equipRepo },
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(RoutingProcess), useValue: routingRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemRepo },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: numbering },
      ],
    }).compile();
    service = module.get(CarrierFlowService);
    jest.spyOn(service, 'getContents').mockResolvedValue([]);
  });

  it('select: 미등록 대차는 404', async () => {
    carrierRepo.findOne.mockResolvedValue(null);
    await expect(service.select('CR-X', 'EQ1', COMPANY, PLANT)).rejects.toThrow(NotFoundException);
  });

  it('select: 사용중지 대차는 400, 정상이면 설비 CUR_CARRIER_NO 갱신', async () => {
    carrierRepo.findOne.mockResolvedValue({ carrierNo: 'CR-001', carrierType: 'CART', useYn: 'N', capacity: null });
    equipRepo.findOne.mockResolvedValue({ equipCode: 'EQ1', processCode: 'P10', currentJobOrderId: 'W1' });
    await expect(service.select('CR-001', 'EQ1', COMPANY, PLANT)).rejects.toThrow(BadRequestException);

    carrierRepo.findOne.mockResolvedValue({ carrierNo: 'CR-001', carrierType: 'CART', useYn: 'Y', capacity: null });
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'W1', itemCode: 'SFG-1', routingCode: 'R1' });
    routingRepo.find.mockResolvedValue([]);
    await service.select('CR-001', 'EQ1', COMPANY, PLANT);
    expect(equipRepo.update).toHaveBeenCalledWith(
      { equipCode: 'EQ1', company: COMPANY, plant: PLANT },
      { curCarrierNo: 'CR-001' },
    );
  });

  it('issueSlip: 빈 대차는 400, 이미 전표가 있으면 같은 번호로 재발행', async () => {
    carrierRepo.findOne.mockResolvedValue({ carrierNo: 'CR-001', carrierType: 'CART', useYn: 'Y', capacity: null });
    (service.getContents as jest.Mock).mockResolvedValue([]);
    await expect(service.issueSlip('CR-001', 'tester', COMPANY, PLANT)).rejects.toThrow(/빈 대차/);

    (service.getContents as jest.Mock).mockResolvedValue([
      { kind: 'SG', barcode: 'SG1', itemCode: 'SFG-1', itemName: null, orderNo: 'W1', qty: 10, loadedAt: new Date(), slipNo: 'CS260918-00007', issueProcessCode: 'P10' },
    ]);
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'W1', itemCode: 'SFG-1', routingCode: 'R1' });
    routingRepo.find.mockResolvedValue([{ seq: 10, processCode: 'P10', processName: '절단', useYn: 'Y', executionType: 'IN_HOUSE' }, { seq: 20, processCode: 'P20', processName: '압착', useYn: 'Y', executionType: 'IN_HOUSE' }]);
    const slip = await service.issueSlip('CR-001', 'tester', COMPANY, PLANT);
    expect(slip.slipNo).toBe('CS260918-00007');
    expect(slip.reprint).toBe(true);
    expect(slip.toProcessCode).toBe('P20');
    expect(numbering.nextCarrierSlipNo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: 실행해 실패 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-flow.service.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 8: 서비스 구현**

```ts
/**
 * @file carrier-flow.service.ts
 * @description 대차 흐름 서비스 — 내용 조회(3테이블 UNION), 상태 도출, 출력 대차 지정/해제, 이동전표, 자동투입 목록, 현황 목록.
 *
 * 초보자 가이드:
 * 1. 규칙은 carrier-flow.rules.ts(순수). 여기는 DB 읽기·쓰기와 규칙 호출만.
 * 2. 스탬프/해제(stampInTx/clearInTx)는 실적·확정·장착·출고 서비스가 자기 트랜잭션 안에서 호출한다.
 * 3. 대차번호는 normalizeCarrierNo로 정규화해 마스터와 맞춘다.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryRunner, Repository } from 'typeorm';
import { CarrierMaster } from '../../../entities/carrier-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { normalizeCarrierNo } from '../../master/services/carrier.service';
import {
  assertCanAutoInput, assertCanLoad, carrierKindOf, deriveCarrierStatus,
  type CarrierContentKind, type CarrierContentRow, type CarrierStatus,
} from './carrier-flow.rules';
import { CarrierListQueryDto } from '../dto/carrier-flow.dto';

export interface CarrierStatusView {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: CarrierStatus;
  kind: CarrierContentKind | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  nextProcessCode: string | null;
  nextProcessName: string | null;
  contents: CarrierContentRow[];
}

export interface CarrierSlipView extends CarrierStatusView {
  slipNo: string;
  issuedAt: string;
  issuedBy: string;
  reprint: boolean;
  fromProcessCode: string | null;
  fromProcessName: string | null;
  toProcessCode: string | null;
  toProcessName: string | null;
}

export interface CarrierListRow {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: CarrierStatus;
  kind: CarrierContentKind | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  lastLoadedAt: Date | null;
}

/** 3테이블 UNION ALL — 대차에 지금 담긴 것. MAT는 orderNo 없음, qty=CURRENT_QTY */
const CONTENTS_SQL = `
  SELECT 'SG' AS KIND, s.SG_BARCODE AS BARCODE, s.ITEM_CODE, s.ORDER_NO, s.REMAIN_QTY AS QTY,
         s.CARRIER_LOADED_AT AS LOADED_AT, s.CARRIER_SLIP_NO AS SLIP_NO, s.ISSUE_PROCESS_CODE
    FROM SG_LABELS s WHERE s.COMPANY = :1 AND s.PLANT_CD = :2 AND s.CARRIER_NO = :3
  UNION ALL
  SELECT 'FG', f.FG_BARCODE, f.ITEM_CODE, f.ORDER_NO, 1, f.CARRIER_LOADED_AT, f.CARRIER_SLIP_NO, NULL
    FROM FG_LABELS f WHERE f.COMPANY = :4 AND f.PLANT_CD = :5 AND f.CARRIER_NO = :6
  UNION ALL
  SELECT 'MAT', m.MAT_UID, m.ITEM_CODE, NULL, m.CURRENT_QTY, m.CARRIER_LOADED_AT, m.CARRIER_SLIP_NO, NULL
    FROM MAT_LOTS m WHERE m.COMPANY = :7 AND m.PLANT_CD = :8 AND m.CARRIER_NO = :9
  ORDER BY LOADED_AT, BARCODE`;

@Injectable()
export class CarrierFlowService {
  constructor(
    @InjectRepository(CarrierMaster) private readonly carrierRepo: Repository<CarrierMaster>,
    @InjectRepository(EquipMaster) private readonly equipRepo: Repository<EquipMaster>,
    @InjectRepository(JobOrder) private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(RoutingProcess) private readonly routingRepo: Repository<RoutingProcess>,
    @InjectRepository(ItemMaster) private readonly itemRepo: Repository<ItemMaster>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private async findCarrierOrFail(carrierNo: string, company: string, plant: string): Promise<CarrierMaster> {
    const row = await this.carrierRepo.findOne({ where: { company, plant, carrierNo: normalizeCarrierNo(carrierNo) } });
    if (!row) throw new NotFoundException(`등록되지 않은 대차입니다: ${carrierNo}`);
    return row;
  }

  /** 대차번호로 마스터 존재 여부만 — 화면의 "이 바코드가 대차인가" 판별용 */
  async isCarrier(barcode: string, company: string, plant: string): Promise<boolean> {
    const row = await this.carrierRepo.findOne({ where: { company, plant, carrierNo: normalizeCarrierNo(barcode) }, select: ['carrierNo'] });
    return !!row;
  }

  async getContents(carrierNo: string, company: string, plant: string, qr?: QueryRunner): Promise<CarrierContentRow[]> {
    const no = normalizeCarrierNo(carrierNo);
    const manager = qr?.manager ?? this.carrierRepo.manager;
    const raw: Array<Record<string, unknown>> = await manager.query(CONTENTS_SQL, [company, plant, no, company, plant, no, company, plant, no]);
    const rows: CarrierContentRow[] = raw.map((r) => ({
      kind: String(r.KIND) as CarrierContentKind,
      barcode: String(r.BARCODE),
      itemCode: String(r.ITEM_CODE),
      itemName: null,
      orderNo: r.ORDER_NO == null ? null : String(r.ORDER_NO),
      qty: Number(r.QTY ?? 0),
      loadedAt: r.LOADED_AT ? new Date(r.LOADED_AT as string) : null,
      slipNo: r.SLIP_NO == null ? null : String(r.SLIP_NO),
      issueProcessCode: r.ISSUE_PROCESS_CODE == null ? null : String(r.ISSUE_PROCESS_CODE),
    }));
    const itemCodes = [...new Set(rows.map((r) => r.itemCode))];
    if (itemCodes.length > 0) {
      const items = await this.itemRepo.find({ where: { itemCode: In(itemCodes) }, select: ['itemCode', 'itemName'] });
      const nameMap = new Map(items.map((i) => [i.itemCode, i.itemName]));
      for (const r of rows) r.itemName = nameMap.get(r.itemCode) ?? null;
    }
    return rows;
  }

  /** 출발 공정의 다음 사내 사용 공정 — 전표의 "가야 할 곳" */
  private async resolveNextProcess(orderNo: string | null, fromProcessCode: string | null, company: string, plant: string) {
    if (!orderNo || !fromProcessCode) return { fromName: null, toCode: null, toName: null };
    const jobOrder = await this.jobOrderRepo.findOne({ where: { orderNo, company, plant } });
    if (!jobOrder?.routingCode) return { fromName: null, toCode: null, toName: null };
    const steps = await this.routingRepo.find({ where: { routingCode: jobOrder.routingCode, company, plant }, order: { seq: 'ASC' } });
    const idx = steps.findIndex((s) => s.processCode === fromProcessCode);
    const from = idx >= 0 ? steps[idx] : null;
    const to = idx >= 0 ? steps.slice(idx + 1).find((s) => s.useYn === 'Y' && s.executionType === 'IN_HOUSE') ?? null : null;
    return { fromName: from?.processName ?? null, toCode: to?.processCode ?? null, toName: to?.processName ?? null };
  }

  private toView(master: CarrierMaster, rows: CarrierContentRow[], next: { toCode: string | null; toName: string | null }): CarrierStatusView {
    const head = rows[0];
    return {
      carrierNo: master.carrierNo,
      carrierType: master.carrierType,
      carrierName: master.carrierName,
      capacity: master.capacity,
      status: deriveCarrierStatus(rows),
      kind: carrierKindOf(rows),
      itemCode: head?.itemCode ?? null,
      itemName: head?.itemName ?? null,
      orderNo: head?.orderNo ?? null,
      loadedCount: rows.length,
      totalQty: rows.reduce((s, r) => s + r.qty, 0),
      slipNo: rows.find((r) => r.slipNo)?.slipNo ?? null,
      loadProcessCode: head?.issueProcessCode ?? null,
      nextProcessCode: next.toCode,
      nextProcessName: next.toName,
      contents: rows,
    };
  }

  async getStatus(carrierNo: string, company: string, plant: string): Promise<CarrierStatusView> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    const rows = await this.getContents(master.carrierNo, company, plant);
    const next = await this.resolveNextProcess(rows[0]?.orderNo ?? null, rows[0]?.issueProcessCode ?? null, company, plant);
    return this.toView(master, rows, next);
  }

  async getProcessFlags(orderNo: string, processCode: string, company: string, plant: string) {
    const jobOrder = await this.jobOrderRepo.findOne({ where: { orderNo, company, plant } });
    if (!jobOrder?.routingCode) return { carrierLoadYn: 'N', carrierAutoInputYn: 'N', issueLabelType: 'NONE' };
    const step = await this.routingRepo.findOne({ where: { routingCode: jobOrder.routingCode, processCode, company, plant } });
    return {
      carrierLoadYn: step?.carrierLoadYn ?? 'N',
      carrierAutoInputYn: step?.carrierAutoInputYn ?? 'N',
      issueLabelType: step?.issueLabelType ?? 'NONE',
    };
  }

  /** 설비 공정 플래그 — 자동투입 검사용 (설비→공정→작업지시 라우팅) */
  private async resolveEquipAutoInputYn(equip: EquipMaster, company: string, plant: string): Promise<string> {
    if (!equip.processCode || !equip.currentJobOrderId) return 'N';
    const flags = await this.getProcessFlags(equip.currentJobOrderId, equip.processCode, company, plant);
    return flags.carrierAutoInputYn;
  }

  async select(carrierNo: string, equipCode: string, company: string, plant: string): Promise<CarrierStatusView> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    if (master.useYn !== 'Y') throw new BadRequestException(`사용 중지된 대차입니다: ${master.carrierNo}`);
    const equip = await this.equipRepo.findOne({ where: { equipCode, company, plant } });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    const rows = await this.getContents(master.carrierNo, company, plant);
    const jobOrder = equip.currentJobOrderId
      ? await this.jobOrderRepo.findOne({ where: { orderNo: equip.currentJobOrderId, company, plant } })
      : null;
    // 담긴 것이 있으면 설비의 현재 작업지시·품목과 같아야 한다(생산 대차 규칙). 종류는 기존 내용을 따른다.
    const kind: CarrierContentKind = carrierKindOf(rows) ?? 'SG';
    assertCanLoad({
      rows, kind,
      itemCode: jobOrder?.itemCode ?? rows[0]?.itemCode ?? '',
      orderNo: jobOrder?.orderNo ?? null,
      addCount: 1,
      capacity: master.capacity,
    });
    await this.equipRepo.update({ equipCode, company, plant }, { curCarrierNo: master.carrierNo });
    const next = await this.resolveNextProcess(rows[0]?.orderNo ?? null, rows[0]?.issueProcessCode ?? null, company, plant);
    return this.toView(master, rows, next);
  }

  async release(equipCode: string, company: string, plant: string): Promise<void> {
    await this.equipRepo.update({ equipCode, company, plant }, { curCarrierNo: null });
  }

  /** 실적/확정 서비스가 같은 트랜잭션에서 호출 — 담기 직전 검증 */
  async assertLoadableInTx(qr: QueryRunner, p: {
    carrierNo: string; kind: CarrierContentKind; itemCode: string; orderNo: string | null; addCount: number; company: string; plant: string;
  }): Promise<CarrierMaster> {
    const master = await qr.manager.findOne(CarrierMaster, { where: { company: p.company, plant: p.plant, carrierNo: normalizeCarrierNo(p.carrierNo) } });
    if (!master) throw new NotFoundException(`등록되지 않은 대차입니다: ${p.carrierNo}`);
    if (master.useYn !== 'Y') throw new BadRequestException(`사용 중지된 대차입니다: ${master.carrierNo}`);
    const rows = await this.getContents(master.carrierNo, p.company, p.plant, qr);
    assertCanLoad({ rows, kind: p.kind, itemCode: p.itemCode, orderNo: p.orderNo, addCount: p.addCount, capacity: master.capacity });
    return master;
  }

  /** 라벨/LOT에 대차를 찍는다 (같은 트랜잭션) */
  async stampInTx(qr: QueryRunner, kind: CarrierContentKind, barcodes: string[], carrierNo: string, company: string, plant: string): Promise<void> {
    if (barcodes.length === 0) return;
    const patch = { carrierNo: normalizeCarrierNo(carrierNo), carrierLoadedAt: new Date(), carrierSlipNo: null };
    if (kind === 'SG') await qr.manager.update(SgLabel, { sgBarcode: In(barcodes), company, plant }, patch);
    else if (kind === 'FG') await qr.manager.update(FgLabel, { fgBarcode: In(barcodes), company, plant }, patch);
    else await qr.manager.update(MatLot, { matUid: In(barcodes), company, plant }, patch);
  }

  /** 소비·취소 시 대차 컬럼을 비운다 (같은 트랜잭션). 대차에 없던 바코드는 영향 없음 */
  async clearInTx(qr: QueryRunner, kind: CarrierContentKind, barcodes: string[], company: string, plant: string): Promise<void> {
    if (barcodes.length === 0) return;
    const patch = { carrierNo: null, carrierLoadedAt: null, carrierSlipNo: null };
    if (kind === 'SG') await qr.manager.update(SgLabel, { sgBarcode: In(barcodes), company, plant }, patch);
    else if (kind === 'FG') await qr.manager.update(FgLabel, { fgBarcode: In(barcodes), company, plant }, patch);
    else await qr.manager.update(MatLot, { matUid: In(barcodes), company, plant }, patch);
  }

  async issueSlip(carrierNo: string, userId: string, company: string, plant: string): Promise<CarrierSlipView> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    return this.tx.run(async (qr) => {
      const rows = await this.getContents(master.carrierNo, company, plant, qr);
      if (rows.length === 0) throw new BadRequestException('빈 대차입니다. 담긴 것이 없어 이동전표를 발행할 수 없습니다.');
      const existing = rows.find((r) => r.slipNo)?.slipNo ?? null;
      const slipNo = existing ?? await this.numbering.nextCarrierSlipNo(qr);
      if (!existing) {
        const byKind = new Map<CarrierContentKind, string[]>();
        for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.barcode]);
        for (const [kind, barcodes] of byKind) {
          const patch = { carrierSlipNo: slipNo };
          if (kind === 'SG') await qr.manager.update(SgLabel, { sgBarcode: In(barcodes), company, plant }, patch);
          else if (kind === 'FG') await qr.manager.update(FgLabel, { fgBarcode: In(barcodes), company, plant }, patch);
          else await qr.manager.update(MatLot, { matUid: In(barcodes), company, plant }, patch);
        }
        for (const r of rows) r.slipNo = slipNo;
        // 전표가 나간 대차는 더 담지 않는다 — 설비의 출력 대차 지정을 푼다
        await qr.manager.update(EquipMaster, { curCarrierNo: master.carrierNo, company, plant }, { curCarrierNo: null });
      }
      const from = rows[0]?.issueProcessCode ?? null;
      const next = await this.resolveNextProcess(rows[0]?.orderNo ?? null, from, company, plant);
      const view = this.toView(master, rows, next);
      return {
        ...view,
        slipNo,
        issuedAt: new Date().toISOString(),
        issuedBy: userId,
        reprint: !!existing,
        fromProcessCode: from,
        fromProcessName: next.fromName,
        toProcessCode: next.toCode,
        toProcessName: next.toName,
      };
    });
  }

  async getAutoInputRows(carrierNo: string, equipCode: string, company: string, plant: string): Promise<{ kind: CarrierContentKind | null; rows: CarrierContentRow[] }> {
    const master = await this.findCarrierOrFail(carrierNo, company, plant);
    const equip = await this.equipRepo.findOne({ where: { equipCode, company, plant } });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    const rows = await this.getContents(master.carrierNo, company, plant);
    const autoInputYn = await this.resolveEquipAutoInputYn(equip, company, plant);
    assertCanAutoInput({ rows, autoInputYn });
    return { kind: carrierKindOf(rows), rows };
  }

  /** 현황 목록 — 마스터 + 내용 집계(서버 페이징). 바코드 검색은 3테이블에서 대차번호를 찾아 필터 */
  async list(query: CarrierListQueryDto, company: string, plant: string): Promise<{ data: CarrierListRow[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 50, search, carrierStatus = 'ACTIVE', processCode, barcode } = query;
    const params: unknown[] = [company, plant];
    const where: string[] = ['c.COMPANY = :1', 'c.PLANT_CD = :2'];
    const bind = (v: unknown) => { params.push(v); return `:${params.length}`; };
    if (search?.trim()) where.push(`(UPPER(c.CARRIER_NO) LIKE ${bind(`%${search.trim().toUpperCase()}%`)} OR UPPER(c.CARRIER_NAME) LIKE ${bind(`%${search.trim().toUpperCase()}%`)})`);
    if (barcode?.trim()) {
      const b = barcode.trim();
      where.push(`c.CARRIER_NO IN (
        SELECT CARRIER_NO FROM SG_LABELS WHERE COMPANY = c.COMPANY AND PLANT_CD = c.PLANT_CD AND SG_BARCODE = ${bind(b)}
        UNION ALL SELECT CARRIER_NO FROM FG_LABELS WHERE COMPANY = c.COMPANY AND PLANT_CD = c.PLANT_CD AND FG_BARCODE = ${bind(b)}
        UNION ALL SELECT CARRIER_NO FROM MAT_LOTS WHERE COMPANY = c.COMPANY AND PLANT_CD = c.PLANT_CD AND MAT_UID = ${bind(b)})`);
    }
    const statusExpr = `CASE WHEN a.LOADED_COUNT IS NULL OR a.LOADED_COUNT = 0 THEN 'EMPTY' WHEN a.SLIP_NO IS NOT NULL THEN 'IN_TRANSIT' ELSE 'LOADING' END`;
    const having: string[] = [];
    if (carrierStatus === 'ACTIVE') having.push(`${statusExpr} <> 'EMPTY'`);
    else if (carrierStatus) having.push(`${statusExpr} = ${bind(carrierStatus)}`);
    if (processCode) having.push(`a.LOAD_PROCESS_CODE = ${bind(processCode)}`);

    const base = `
      FROM CARRIER_MASTERS c
      LEFT JOIN (
        SELECT CARRIER_NO, COMPANY, PLANT_CD, MIN(KIND) KIND, MIN(ITEM_CODE) ITEM_CODE, MIN(ORDER_NO) ORDER_NO,
               COUNT(*) LOADED_COUNT, SUM(QTY) TOTAL_QTY, MAX(SLIP_NO) SLIP_NO, MIN(ISSUE_PROCESS_CODE) LOAD_PROCESS_CODE, MAX(LOADED_AT) LAST_LOADED_AT
          FROM (
            SELECT CARRIER_NO, COMPANY, PLANT_CD, 'SG' KIND, ITEM_CODE, ORDER_NO, REMAIN_QTY QTY, CARRIER_SLIP_NO SLIP_NO, ISSUE_PROCESS_CODE, CARRIER_LOADED_AT LOADED_AT FROM SG_LABELS WHERE CARRIER_NO IS NOT NULL
            UNION ALL SELECT CARRIER_NO, COMPANY, PLANT_CD, 'FG', ITEM_CODE, ORDER_NO, 1, CARRIER_SLIP_NO, NULL, CARRIER_LOADED_AT FROM FG_LABELS WHERE CARRIER_NO IS NOT NULL
            UNION ALL SELECT CARRIER_NO, COMPANY, PLANT_CD, 'MAT', ITEM_CODE, NULL, CURRENT_QTY, CARRIER_SLIP_NO, NULL, CARRIER_LOADED_AT FROM MAT_LOTS WHERE CARRIER_NO IS NOT NULL
          ) GROUP BY CARRIER_NO, COMPANY, PLANT_CD
      ) a ON a.CARRIER_NO = c.CARRIER_NO AND a.COMPANY = c.COMPANY AND a.PLANT_CD = c.PLANT_CD
      WHERE ${where.join(' AND ')}${having.length ? ' AND ' + having.join(' AND ') : ''}`;
    const manager = this.carrierRepo.manager;
    const countRows: Array<{ CNT: number }> = await manager.query(`SELECT COUNT(*) CNT ${base}`, params);
    const total = Number(countRows[0]?.CNT ?? 0);
    const offset = (page - 1) * limit;
    const dataRows: Array<Record<string, unknown>> = await manager.query(
      `SELECT c.CARRIER_NO, c.CARRIER_TYPE, c.CARRIER_NAME, c.CAPACITY, ${statusExpr} STATUS, a.KIND, a.ITEM_CODE, a.ORDER_NO,
              NVL(a.LOADED_COUNT,0) LOADED_COUNT, NVL(a.TOTAL_QTY,0) TOTAL_QTY, a.SLIP_NO, a.LOAD_PROCESS_CODE, a.LAST_LOADED_AT
       ${base} ORDER BY a.LAST_LOADED_AT DESC NULLS LAST, c.CARRIER_NO
       OFFSET ${bind(offset)} ROWS FETCH NEXT ${bind(limit)} ROWS ONLY`, params);
    const itemCodes = [...new Set(dataRows.map((r) => r.ITEM_CODE).filter((v): v is string => typeof v === 'string'))];
    const items = itemCodes.length ? await this.itemRepo.find({ where: { itemCode: In(itemCodes) }, select: ['itemCode', 'itemName'] }) : [];
    const nameMap = new Map(items.map((i) => [i.itemCode, i.itemName]));
    return {
      data: dataRows.map((r) => ({
        carrierNo: String(r.CARRIER_NO),
        carrierType: String(r.CARRIER_TYPE),
        carrierName: r.CARRIER_NAME == null ? null : String(r.CARRIER_NAME),
        capacity: r.CAPACITY == null ? null : Number(r.CAPACITY),
        status: String(r.STATUS) as CarrierStatus,
        kind: r.KIND == null ? null : (String(r.KIND) as CarrierContentKind),
        itemCode: r.ITEM_CODE == null ? null : String(r.ITEM_CODE),
        itemName: r.ITEM_CODE == null ? null : nameMap.get(String(r.ITEM_CODE)) ?? null,
        orderNo: r.ORDER_NO == null ? null : String(r.ORDER_NO),
        loadedCount: Number(r.LOADED_COUNT ?? 0),
        totalQty: Number(r.TOTAL_QTY ?? 0),
        slipNo: r.SLIP_NO == null ? null : String(r.SLIP_NO),
        loadProcessCode: r.LOAD_PROCESS_CODE == null ? null : String(r.LOAD_PROCESS_CODE),
        lastLoadedAt: r.LAST_LOADED_AT ? new Date(r.LAST_LOADED_AT as string) : null,
      })),
      total, page, limit,
    };
  }
}
```

- [ ] **Step 9: 컨트롤러**

```ts
/**
 * @file carrier-flow.controller.ts
 * @description 대차 흐름 API
 * 1. GET  /production/carriers                      — 현황 목록(상태·공정·바코드 검색, 서버 페이징)
 * 2. GET  /production/carriers/process-flags        — 작업지시+공정의 대차 플래그
 * 3. GET  /production/carriers/:no                  — 상태·내용·다음 공정
 * 4. POST /production/carriers/release              — 설비의 출력 대차 해제
 * 5. POST /production/carriers/:no/select           — 출력 대차 지정(검증)
 * 6. POST /production/carriers/:no/slip             — 이동전표 발행/재발행
 * 7. GET  /production/carriers/:no/auto-input       — 자동투입 대상 목록(검증)
 * 라우트 주의: 'process-flags', 'release'는 ':no'보다 먼저 선언한다.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { CarrierFlowService } from '../services/carrier-flow.service';
import { CarrierAutoInputQueryDto, CarrierListQueryDto, CarrierProcessFlagsQueryDto, ReleaseCarrierDto, SelectCarrierDto } from '../dto/carrier-flow.dto';

@ApiTags('생산 - 대차 흐름')
@Controller('production/carriers')
export class CarrierFlowController {
  constructor(private readonly svc: CarrierFlowService) {}

  @Get()
  @ApiOperation({ summary: '대차 현황 목록' })
  async list(@Query() query: CarrierListQueryDto, @Company() company: string, @Plant() plant: string) {
    const r = await this.svc.list(query, company, plant);
    return ResponseUtil.paged(r.data, r.total, r.page, r.limit);
  }

  @Get('process-flags')
  @ApiOperation({ summary: '작업지시+공정의 대차 적재/자동투입 플래그' })
  async processFlags(@Query() q: CarrierProcessFlagsQueryDto, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.getProcessFlags(q.orderNo, q.processCode, company, plant));
  }

  @Post('release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '설비의 출력 대차 지정 해제' })
  async release(@Body() dto: ReleaseCarrierDto, @Company() company: string, @Plant() plant: string) {
    await this.svc.release(dto.equipCode, company, plant);
    return ResponseUtil.success({ released: true });
  }

  @Get(':no')
  @ApiOperation({ summary: '대차 상태·내용·다음 공정' })
  async status(@Param('no') no: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.getStatus(no, company, plant));
  }

  @Post(':no/select')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출력 대차 지정 — 검증 후 설비 CUR_CARRIER_NO 갱신' })
  async select(@Param('no') no: string, @Body() dto: SelectCarrierDto, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.select(no, dto.equipCode, company, plant), '출력 대차가 지정되었습니다.');
  }

  @Post(':no/slip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '이동전표 발행/재발행' })
  async slip(@Param('no') no: string, @Company() company: string, @Plant() plant: string, @Req() req: AuthenticatedRequest) {
    return ResponseUtil.success(await this.svc.issueSlip(no, req.user?.id ?? 'SYSTEM', company, plant));
  }

  @Get(':no/auto-input')
  @ApiOperation({ summary: '자동투입 대상 목록 — 설비 공정 플래그·전표·빈 대차 검증' })
  async autoInput(@Param('no') no: string, @Query() q: CarrierAutoInputQueryDto, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.getAutoInputRows(no, q.equipCode, company, plant));
  }
}
```
`production.module.ts`: controllers에 `CarrierFlowController`, providers·exports에 `CarrierFlowService`. `TypeOrmModule.forFeature`에 `CarrierMaster`, `MatLot`, `FgLabel`, `SgLabel`, `RoutingProcess`, `JobOrder`, `EquipMaster`, `ItemMaster`가 있는지 확인(대부분 이미 있음).

- [ ] **Step 10: 테스트·typecheck**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-flow
pnpm.cmd run typecheck:backend
```
Expected: rules 8 + service 3 passed, 오류 0. dev 백엔드가 떠 있으면 `curl http://localhost:3003/api/production/carriers?limit=5`(로그인 토큰 필요 시 브라우저 devtools에서 확인)로 200 확인.

- [ ] **Step 11: Commit**

```bash
git add apps/backend/src/modules/production/services/carrier-flow.rules.ts apps/backend/src/modules/production/services/carrier-flow.rules.spec.ts apps/backend/src/modules/production/services/carrier-flow.service.ts apps/backend/src/modules/production/services/carrier-flow.service.spec.ts apps/backend/src/modules/production/controllers/carrier-flow.controller.ts apps/backend/src/modules/production/dto/carrier-flow.dto.ts apps/backend/src/modules/production/production.module.ts
git commit -F "$TEMP/cm.txt"   # "feat(production): 대차 상태 도출·출력 대차 지정·이동전표·자동투입 목록 API를 추가한다"
```

---

### Task 8: 실적·확정 서비스의 대차 차단·스탬프

**Files:**
- Modify: `apps/backend/src/modules/production/dto/prod-result.dto.ts` (`CreateProdResultDto`에 `carrierNo?`), `dto/subprocess-kitting.dto.ts` (`ConfirmAssemblyDto`, `ConfirmSubKitDto`에 `carrierNo?`)
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts` (create: 라우팅 step 조회 후 게이트, 저장 시 carrierNo, issueSgLabelInTx 뒤 스탬프)
- Modify: `apps/backend/src/modules/production/services/subprocess-kitting.service.ts` (confirmAssembly: FG 스탬프, confirmSubKit: 새 SG 스탬프, 둘 다 ProdResult.carrierNo)
- Test: `apps/backend/src/modules/production/services/carrier-gate.rules.spec.ts` + Create `carrier-gate.rules.ts`

**Interfaces:**
- Consumes: `CarrierFlowService.assertLoadableInTx`, `stampInTx` (Task 7)
- Produces: `assertCarrierGate(step: { carrierLoadYn?: string | null } | null, carrierNo: string | undefined): void` — 플래그 Y인데 carrierNo 없으면 400 "출력 대차를 스캔하세요"

- [ ] **Step 1: 게이트 규칙 테스트(실패)**

```ts
import { BadRequestException } from '@nestjs/common';
import { assertCarrierGate } from './carrier-gate.rules';

describe('assertCarrierGate', () => {
  it('플래그 Y + 대차 없음 → 400', () => {
    expect(() => assertCarrierGate({ carrierLoadYn: 'Y' }, undefined)).toThrow(BadRequestException);
    expect(() => assertCarrierGate({ carrierLoadYn: 'Y' }, '  ')).toThrow(/출력 대차/);
  });
  it('플래그 Y + 대차 있음 → 통과', () => {
    expect(() => assertCarrierGate({ carrierLoadYn: 'Y' }, 'CR-001')).not.toThrow();
  });
  it('플래그 N/없음 → 대차 유무와 무관하게 통과', () => {
    expect(() => assertCarrierGate({ carrierLoadYn: 'N' }, undefined)).not.toThrow();
    expect(() => assertCarrierGate(null, 'CR-001')).not.toThrow();
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-gate.rules.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: 규칙 + DTO**

```ts
/**
 * @file carrier-gate.rules.ts
 * @description 실적 저장 대차 게이트 — 라우팅 공정 CARRIER_LOAD_YN='Y'면 출력 대차 없이 저장할 수 없다(설계 2절 "미스캔=차단").
 */
import { BadRequestException } from '@nestjs/common';

export function assertCarrierGate(step: { carrierLoadYn?: string | null } | null, carrierNo: string | undefined): void {
  if (step?.carrierLoadYn !== 'Y') return;
  if (!carrierNo || !carrierNo.trim()) {
    throw new BadRequestException('출력 대차를 스캔하세요. 이 공정은 실적 라벨을 대차에 담아야 합니다.');
  }
}
```
DTO 3곳(`CreateProdResultDto`의 `qtyPerBundle` 아래, `ConfirmAssemblyDto`의 `sgBarcodes` 아래, `ConfirmSubKitDto`의 `defectQty` 아래) 동일 필드:
```ts
  @ApiPropertyOptional({ description: '출력 대차번호 — 공정 CARRIER_LOAD_YN=Y면 필수. 발행되는 라벨에 스탬프' })
  @IsOptional() @IsString() @MaxLength(30)
  carrierNo?: string;
```

- [ ] **Step 4: ProdResultService.create 수정**

1) 생성자에 `private readonly carrierFlow: CarrierFlowService,` 주입(import 추가). 기존 spec 파일(`prod-result.cancel.spec.ts`, `prod-result.delete.policy.spec.ts`)의 provider 목록에 `{ provide: CarrierFlowService, useValue: { assertLoadableInTx: jest.fn(), stampInTx: jest.fn(), clearInTx: jest.fn() } }` 추가.
2) L862 `if (dto.processCode) { … const step = … }` 블록에서 `step`을 블록 밖 변수로 올린다: 블록 앞에 `let routingStep: RoutingProcess | null = null;`, 조회 후 `routingStep = step;`. 블록 끝난 뒤 `assertCarrierGate(routingStep, dto.carrierNo);`.
3) `prodResultRepository.create({...})`에 `carrierNo: dto.carrierNo?.trim().toUpperCase() ?? null,` 추가.
4) `issueSgLabelInTx` 호출 직후:
```ts
      // 출력 대차 적재 — 이 실적으로 발행된 SG 라벨을 스캔된 대차에 담는다(공정 CARRIER_LOAD_YN=Y).
      if (dto.carrierNo && routingStep?.carrierLoadYn === 'Y') {
        const issued = await queryRunner.manager.find(SgLabel, {
          where: { resultNo: saved.resultNo, company: jobOrder.company, plant: jobOrder.plant },
          select: ['sgBarcode'],
        });
        if (issued.length > 0) {
          await this.carrierFlow.assertLoadableInTx(queryRunner, {
            carrierNo: dto.carrierNo, kind: 'SG', itemCode: jobOrder.itemCode, orderNo: jobOrder.orderNo,
            addCount: issued.length, company: jobOrder.company, plant: jobOrder.plant,
          });
          await this.carrierFlow.stampInTx(queryRunner, 'SG', issued.map((l) => l.sgBarcode), dto.carrierNo, jobOrder.company, jobOrder.plant);
        }
      }
```
(`assertLoadableInTx`는 트랜잭션 안에서 다시 검증하므로 select 이후 대차가 바뀌었어도 안전하다. 수용량 초과면 400 "대차 교체"가 그대로 클라이언트로 간다.)

- [ ] **Step 5: SubprocessKittingService 수정**

생성자에 `private readonly carrierFlow: CarrierFlowService` 주입. 두 확정 메서드 모두 초반에 라우팅 step을 조회한다(`isFgPrintProcess`가 쓰는 같은 `routingCode/processCode`로 `qr.manager.findOne(RoutingProcess, { where: { routingCode: jobOrder.routingCode, processCode, company, plant } })`) 후 `assertCarrierGate(step, dto.carrierNo)`.

`confirmAssembly` — "6. ProdResult 저장" 객체에 `carrierNo: dto.carrierNo?.trim().toUpperCase() ?? null,` 추가. 저장 직후:
```ts
      if (dto.carrierNo && step?.carrierLoadYn === 'Y') {
        await this.carrierFlow.assertLoadableInTx(qr, { carrierNo: dto.carrierNo, kind: 'FG', itemCode: jobOrder.itemCode, orderNo, addCount: 1, company, plant });
        await this.carrierFlow.stampInTx(qr, 'FG', [fgBarcode], dto.carrierNo, company, plant);
      }
```
`confirmSubKit` — "6. 새 SFG 승격" 직후, 양품(`qualityStatus !== 'DEFECT'`)일 때만:
```ts
      if (dto.carrierNo && step?.carrierLoadYn === 'Y' && qualityStatus !== 'DEFECT') {
        await this.carrierFlow.assertLoadableInTx(qr, { carrierNo: dto.carrierNo, kind: 'SG', itemCode: newSg.itemCode, orderNo, addCount: 1, company, plant });
        await this.carrierFlow.stampInTx(qr, 'SG', [newSgBarcode], dto.carrierNo, company, plant);
      }
```
"7. ProdResult 저장" 객체에 `carrierNo` 추가.

- [ ] **Step 6: 테스트·typecheck**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-gate.rules.spec.ts src/modules/production/services/prod-result src/modules/production/services/subprocess-kitting
pnpm.cmd run typecheck:backend
```
Expected: 전부 pass, 오류 0.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/production/dto/prod-result.dto.ts apps/backend/src/modules/production/dto/subprocess-kitting.dto.ts apps/backend/src/modules/production/services/prod-result.service.ts apps/backend/src/modules/production/services/subprocess-kitting.service.ts apps/backend/src/modules/production/services/carrier-gate.rules.ts apps/backend/src/modules/production/services/carrier-gate.rules.spec.ts apps/backend/src/modules/production/services/prod-result.cancel.spec.ts apps/backend/src/modules/production/services/prod-result.delete.policy.spec.ts
git commit -F "$TEMP/cm.txt"   # "feat(production): 대차 적재 공정은 출력 대차 없이 실적을 막고 발행 라벨에 대차를 찍는다"
```

---

### Task 9: 프론트 공용 `components/shared/carrier`

**Files:**
- Create: `apps/frontend/src/components/shared/carrier/carrierTypes.ts`, `useOutputCarrier.ts`, `OutputCarrierSlot.tsx`, `CarrierSlipPrintModal.tsx`, `useCarrierAutoInput.ts`, `index.ts`
- Test: `apps/frontend/src/components/shared/carrier/carrier.structure.test.mjs`
- Modify: 로케일 4개 — 최상위 `carrier` 블록 신규

**Interfaces:**
- Consumes: Task 7 HTTP API
- Produces:
  - `CarrierContentRow`, `CarrierStatusView`, `CarrierSlipView`, `CarrierProcessFlags { carrierLoadYn, carrierAutoInputYn, issueLabelType }`
  - `useCarrierProcessFlags({ orderNo, processCode }): CarrierProcessFlags | null`
  - `useOutputCarrier({ equipCode, orderNo, processCode, enabled, initialCarrierNo }): { carrier: CarrierStatusView | null; loading: boolean; scan(no: string): Promise<boolean>; clear(): Promise<void>; refresh(): Promise<void>; onCapacityRejected(): void }`
  - `OutputCarrierSlot({ state, compact? })` — 슬롯 UI. `data-testid="carrier-slot-scan"`, `carrier-slot-slip`, `carrier-slot-clear`
  - `CarrierSlipPrintModal({ isOpen, carrierNo, onClose })` — 열릴 때 `POST /production/carriers/:no/slip` 호출 후 A4 인쇄
  - `useCarrierAutoInput({ equipCode, enabled, handleBarcode: (barcode: string) => Promise<boolean> }): { isCarrierCandidate(raw): boolean; run(raw): Promise<{ handled: boolean; ok: number; fail: number }>; running: boolean }`
  - `isLikelyLabelBarcode(raw): boolean` — `/^(SG|FG)\d/i` 또는 `/^VH1-RM/i`면 라벨/LOT (대차 조회 생략)

- [ ] **Step 1: 구조 테스트(실패)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const locales = ['ko', 'en', 'zh', 'vi'].map((lang) => ({
  lang, json: JSON.parse(readFileSync(new URL(`../../../locales/${lang}.json`, import.meta.url), 'utf8')),
}));

test('공용 대차 모듈은 타입·출력슬롯 훅·슬롯 UI·전표 인쇄·자동투입 훅을 export 한다', () => {
  const index = read('./index.ts');
  for (const name of ['OutputCarrierSlot', 'CarrierSlipPrintModal', 'useOutputCarrier', 'useCarrierAutoInput', 'useCarrierProcessFlags', 'isLikelyLabelBarcode']) {
    assert.match(index, new RegExp(name), `${name} export 누락`);
  }
});

test('출력 슬롯은 BarcodeScanInput을 쓰고 alert/confirm·파스텔 배경을 쓰지 않는다', () => {
  const slot = read('./OutputCarrierSlot.tsx');
  assert.match(slot, /BarcodeScanInput/);
  assert.match(slot, /data-testid="carrier-slot-scan"/);
  assert.match(slot, /data-testid="carrier-slot-slip"/);
  assert.doesNotMatch(slot, /\balert\(|\bconfirm\(/);
  assert.doesNotMatch(slot, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-(?:50|100)\b/);
});

test('전표 인쇄는 A4 window.print 패턴이고 대차번호 QR을 담는다', () => {
  const slip = read('./CarrierSlipPrintModal.tsx');
  assert.match(slip, /window\.print\(\)/);
  assert.match(slip, /@page \{ size: A4 portrait/);
  assert.match(slip, /<QRCode value=\{slip\.carrierNo\}/);
  assert.match(slip, /\/production\/carriers\/\$\{encodeURIComponent\(carrierNo\)\}\/slip/);
});

test('자동투입 훅은 라벨 접두어면 대차 조회를 건너뛰고, 바코드마다 화면 처리기를 반복 호출한다', () => {
  const hook = read('./useCarrierAutoInput.ts');
  assert.match(hook, /export function isLikelyLabelBarcode/);
  assert.match(hook, /\^\(SG\|FG\)\\d/);
  assert.match(hook, /VH1-RM/);
  assert.match(hook, /\/auto-input/);
  assert.match(hook, /for \(const row of rows\)/);
  assert.match(hook, /await handleBarcode\(row\.barcode\)/);
});

test('i18n carrier 키가 4개 로케일에 있다', () => {
  const keys = ['slotLabel', 'scanPlaceholder', 'empty', 'loaded', 'inTransit', 'slip', 'clear', 'capacityFull', 'autoInputDone', 'autoInputFailed', 'notCarrier', 'slipTitle', 'from', 'to', 'toFinal', 'issuedAt', 'reprint'];
  for (const { lang, json } of locales) for (const k of keys) assert.ok(json.carrier?.[k], `${lang}: carrier.${k} 누락`);
});
```

- [ ] **Step 2: 실행해 실패 확인**

```powershell
node --test apps/frontend/src/components/shared/carrier/carrier.structure.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: 타입 + 플래그 훅**

`carrierTypes.ts`:
```ts
/**
 * @file components/shared/carrier/carrierTypes.ts
 * @description 대차 흐름 프론트 타입 — 백엔드 CarrierFlowService 응답과 1:1
 */
export type CarrierContentKind = "SG" | "FG" | "MAT";
export type CarrierStatus = "EMPTY" | "LOADING" | "IN_TRANSIT";

export interface CarrierContentRow {
  kind: CarrierContentKind;
  barcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  qty: number;
  loadedAt: string | null;
  slipNo: string | null;
  issueProcessCode: string | null;
}

export interface CarrierStatusView {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: CarrierStatus;
  kind: CarrierContentKind | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  nextProcessCode: string | null;
  nextProcessName: string | null;
  contents: CarrierContentRow[];
}

export interface CarrierSlipView extends CarrierStatusView {
  slipNo: string;
  issuedAt: string;
  issuedBy: string;
  reprint: boolean;
  fromProcessCode: string | null;
  fromProcessName: string | null;
  toProcessCode: string | null;
  toProcessName: string | null;
}

export interface CarrierProcessFlags {
  carrierLoadYn: string;
  carrierAutoInputYn: string;
  issueLabelType: string;
}
```

`useOutputCarrier.ts`:
```ts
"use client";
/**
 * @file components/shared/carrier/useOutputCarrier.ts
 * @description 출력 대차 슬롯 상태 훅 — 공정 플래그 조회, 대차 스캔(select), 해제, 재조회.
 *
 * 초보자 가이드:
 * 1. enabled(=공정 CARRIER_LOAD_YN 'Y')가 아니면 아무것도 하지 않는다. 화면은 state.enabled로 슬롯을 숨긴다.
 * 2. 설비의 CUR_CARRIER_NO(initialCarrierNo)가 있으면 진입 시 상태를 불러와 복원한다.
 * 3. 실적 저장이 "대차 교체" 400을 받으면 onCapacityRejected()로 슬롯을 비운다.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "@/services/api";
import type { CarrierProcessFlags, CarrierStatusView } from "./carrierTypes";

export function useCarrierProcessFlags(input: { orderNo: string | null | undefined; processCode: string | null | undefined }): CarrierProcessFlags | null {
  const { orderNo, processCode } = input;
  const [flags, setFlags] = useState<CarrierProcessFlags | null>(null);
  useEffect(() => {
    if (!orderNo || !processCode) { setFlags(null); return; }
    let alive = true;
    api.get("/production/carriers/process-flags", { params: { orderNo, processCode }, suppressErrorModal: true })
      .then((res) => { if (alive) setFlags(res.data?.data ?? null); })
      .catch(() => { if (alive) setFlags(null); });
    return () => { alive = false; };
  }, [orderNo, processCode]);
  return flags;
}

export interface OutputCarrierState {
  enabled: boolean;
  carrier: CarrierStatusView | null;
  loading: boolean;
  scan: (no: string) => Promise<boolean>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  onCapacityRejected: () => void;
}

export function useOutputCarrier(input: {
  equipCode: string | null | undefined;
  enabled: boolean;
  initialCarrierNo?: string | null;
}): OutputCarrierState {
  const { equipCode, enabled, initialCarrierNo } = input;
  const { t } = useTranslation();
  const [carrier, setCarrier] = useState<CarrierStatusView | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!carrier?.carrierNo) return;
    try {
      const res = await api.get(`/production/carriers/${encodeURIComponent(carrier.carrierNo)}`, { suppressErrorModal: true });
      setCarrier(res.data?.data ?? null);
    } catch { /* 공통 API 레이어 처리 */ }
  }, [carrier?.carrierNo]);

  // 설비 재진입 복원 — CUR_CARRIER_NO가 있으면 상태를 불러온다(전표 발행돼 이미 풀린 대차면 서버가 NULL을 준다)
  useEffect(() => {
    if (!enabled || !initialCarrierNo) { setCarrier(null); return; }
    let alive = true;
    api.get(`/production/carriers/${encodeURIComponent(initialCarrierNo)}`, { suppressErrorModal: true })
      .then((res) => { if (alive) setCarrier(res.data?.data ?? null); })
      .catch(() => { if (alive) setCarrier(null); });
    return () => { alive = false; };
  }, [enabled, initialCarrierNo]);

  const scan = useCallback(async (no: string) => {
    const trimmed = no.trim();
    if (!trimmed || !equipCode) return false;
    setLoading(true);
    try {
      const res = await api.post(`/production/carriers/${encodeURIComponent(trimmed)}/select`, { equipCode }, { skipSuccessToast: true });
      setCarrier(res.data?.data ?? null);
      return true;
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (message) toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [equipCode]);

  const clear = useCallback(async () => {
    if (equipCode) {
      await api.post("/production/carriers/release", { equipCode }, { skipSuccessToast: true, suppressErrorModal: true }).catch(() => undefined);
    }
    setCarrier(null);
  }, [equipCode]);

  const onCapacityRejected = useCallback(() => {
    toast.error(t("carrier.capacityFull", "대차가 가득 찼습니다. 다른 대차를 스캔하세요."));
    setCarrier(null);
  }, [t]);

  return { enabled, carrier, loading, scan, clear, refresh, onCapacityRejected };
}
```

- [ ] **Step 4: 슬롯 UI**

```tsx
"use client";
/**
 * @file components/shared/carrier/OutputCarrierSlot.tsx
 * @description 출력 대차 슬롯 — 대차 스캔칸, 현재 대차·적재수/수용량·상태, 이동전표 버튼. 상태는 useOutputCarrier가 소유.
 *              세 화면(가공·서브조립·조립) 헤더가 같은 컴포넌트를 쓴다. 파스텔 배경 없이 테두리·텍스트로 상태 구분.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileOutput, ShoppingCart, X } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import CarrierSlipPrintModal from "./CarrierSlipPrintModal";
import type { OutputCarrierState } from "./useOutputCarrier";

interface Props {
  state: OutputCarrierState;
  /** 2xl 미만에서 라벨을 숨기는 헤더용 축약 */
  compact?: boolean;
}

export default function OutputCarrierSlot({ state, compact = false }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [slipOpen, setSlipOpen] = useState(false);
  if (!state.enabled) return null;
  const c = state.carrier;
  const statusColor = !c ? "text-text-muted" : c.status === "IN_TRANSIT" ? "text-green-600 dark:text-green-400" : c.loadedCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-text-muted";
  const capacityText = c ? (c.capacity == null ? `${c.loadedCount}` : `${c.loadedCount}/${c.capacity}`) : "";

  return (
    <div className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2" data-testid="carrier-slot">
      <ShoppingCart className="h-4 w-4 shrink-0 text-primary" />
      {!compact && <span className="hidden whitespace-nowrap text-xs font-bold text-text-muted 2xl:inline">{t("carrier.slotLabel", "출력 대차")}</span>}
      {c ? (
        <>
          <span className="font-mono text-sm font-bold text-text">{c.carrierNo}</span>
          <span className={`whitespace-nowrap text-xs font-semibold ${statusColor}`}>
            {c.status === "IN_TRANSIT" ? t("carrier.inTransit", "이동 중") : c.loadedCount > 0 ? t("carrier.loaded", "적재 {{count}}", { count: capacityText }) : t("carrier.empty", "빈 대차")}
          </span>
          <button type="button" data-testid="carrier-slot-slip" onClick={() => setSlipOpen(true)} disabled={c.loadedCount === 0}
            title={t("carrier.slip", "이동전표")} aria-label={t("carrier.slip", "이동전표")}
            className="inline-flex h-7 items-center gap-1 rounded border border-primary px-2 text-xs font-bold text-primary hover:bg-surface disabled:opacity-40">
            <FileOutput className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">{t("carrier.slip", "이동전표")}</span>
          </button>
          <button type="button" data-testid="carrier-slot-clear" onClick={() => void state.clear()} title={t("carrier.clear", "대차 해제")} aria-label={t("carrier.clear", "대차 해제")}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-red-500">
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <div className="w-40">
          <BarcodeScanInput
            value={value}
            onChange={setValue}
            onScan={async (raw) => { const ok = await state.scan(raw); if (ok) setValue(""); }}
            placeholder={t("carrier.scanPlaceholder", "대차 스캔")}
            className="h-8 text-sm"
            disabled={state.loading}
            data-testid="carrier-slot-scan"
            fullWidth
          />
        </div>
      )}
      <CarrierSlipPrintModal isOpen={slipOpen} carrierNo={c?.carrierNo ?? null} onClose={() => { setSlipOpen(false); void state.refresh(); }} />
    </div>
  );
}
```
(`BarcodeScanInput`이 `data-testid`를 그대로 전달하지 않으면 감싸는 div에 `data-testid="carrier-slot-scan"`을 둔다.)

- [ ] **Step 5: 전표 인쇄 모달 (JobOrderPrintModal 패턴)**

```tsx
"use client";
/**
 * @file components/shared/carrier/CarrierSlipPrintModal.tsx
 * @description 대차 이동전표 A4 인쇄 — 열릴 때 발행/재발행 API를 호출하고(전표번호 스탬프), 담긴 내용과 다음 공정을 출력한다.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import QRCode from "react-qr-code";
import { Modal, Button } from "@/components/ui";
import api from "@/services/api";
import type { CarrierSlipView } from "./carrierTypes";

interface Props { isOpen: boolean; carrierNo: string | null; onClose: () => void; }

const fmt = (v?: string | null) => (v ? String(v).replace("T", " ").slice(0, 19) : "-");

export default function CarrierSlipPrintModal({ isOpen, carrierNo, onClose }: Props) {
  const { t } = useTranslation();
  const [slip, setSlip] = useState<CarrierSlipView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !carrierNo) { setSlip(null); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.post(`/production/carriers/${encodeURIComponent(carrierNo)}/slip`, {}, { skipSuccessToast: true });
        if (alive) setSlip(res.data?.data ?? null);
      } catch {
        if (alive) setSlip(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, carrierNo]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("carrier.slipTitle", "대차 이동전표")} size="xl">
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={() => window.print()} disabled={!slip || loading} data-testid="carrier-slip-print">
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>
      {loading && <p className="text-center text-text-muted py-8">{t("common.loading", "불러오는 중...")}</p>}
      {slip && !loading && (
        <div id="carrier-slip-print-area" className="bg-white text-black p-2 text-[13px] leading-relaxed">
          <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
            <div>
              <h1 className="text-2xl font-bold tracking-[0.3em]">{t("carrier.slipTitle", "대차 이동전표")}</h1>
              <div className="text-xs mt-1">
                {t("carrier.issuedAt", "발행")}: {fmt(slip.issuedAt)} · {slip.issuedBy}{slip.reprint ? ` · ${t("carrier.reprint", "재발행")}` : ""}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <QRCode value={slip.carrierNo} size={84} />
              <div className="text-[11px] font-mono font-semibold mt-1">{slip.carrierNo}</div>
            </div>
          </div>
          <table className="w-full border-collapse mb-4 text-[13px]">
            <tbody>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[110px]">{t("carrier.slipNo", "전표번호")}</th>
                <td className="border border-black px-2 py-1 font-mono font-semibold">{slip.slipNo}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[110px]">{t("master.carrier.carrierType", "유형")}</th>
                <td className="border border-black px-2 py-1">{slip.carrierType}{slip.carrierName ? ` · ${slip.carrierName}` : ""}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partCode", "품목코드")}</th>
                <td className="border border-black px-2 py-1">{slip.itemCode ?? "-"}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partName", "품목명")}</th>
                <td className="border border-black px-2 py-1">{slip.itemName ?? "-"}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("production.order.orderNo", "작업지시번호")}</th>
                <td className="border border-black px-2 py-1">{slip.orderNo ?? "-"}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("carrier.from", "출발 공정")} → {t("carrier.to", "도착 공정")}</th>
                <td className="border border-black px-2 py-1 font-semibold">
                  {slip.fromProcessName ?? slip.fromProcessCode ?? "-"} → {slip.toProcessName ?? slip.toProcessCode ?? t("carrier.toFinal", "최종")}
                </td>
              </tr>
            </tbody>
          </table>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-1 py-1 w-[36px]">No</th>
                <th className="border border-black px-2 py-1">{t("carrier.barcode", "바코드")}</th>
                <th className="border border-black px-2 py-1">{t("common.partCode", "품목코드")}</th>
                <th className="border border-black px-2 py-1 w-[70px]">{t("common.qty", "수량")}</th>
                <th className="border border-black px-2 py-1 w-[140px]">{t("carrier.loadedAt", "적재일시")}</th>
              </tr>
            </thead>
            <tbody>
              {slip.contents.map((row, i) => (
                <tr key={row.barcode}>
                  <td className="border border-black px-1 py-1 text-center">{i + 1}</td>
                  <td className="border border-black px-2 py-1 font-mono">{row.barcode}</td>
                  <td className="border border-black px-2 py-1">{row.itemCode}</td>
                  <td className="border border-black px-2 py-1 text-right tabular-nums">{row.qty.toLocaleString()}</td>
                  <td className="border border-black px-2 py-1">{fmt(row.loadedAt)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-black px-2 py-1 text-right" colSpan={3}>{t("common.total", "합계")} ({slip.loadedCount})</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{slip.totalQty.toLocaleString()}</td>
                <td className="border border-black px-2 py-1" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #carrier-slip-print-area, #carrier-slip-print-area * { visibility: visible; }
          #carrier-slip-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>
      <div className="flex justify-end pt-4 border-t border-border mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t("common.close", "닫기")}</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 6: 자동투입 훅**

```ts
"use client";
/**
 * @file components/shared/carrier/useCarrierAutoInput.ts
 * @description 후공정 대차 자동투입 훅 — 스캔값이 대차면 담긴 바코드 목록을 받아 화면의 기존 처리기(handleBarcode)를 바코드마다 호출한다.
 *
 * 초보자 가이드:
 * 1. 새 투입 경로를 만들지 않는다. 화면이 낱개 스캔에 쓰는 함수를 그대로 넘긴다(가공=설비 장착, 서브조립·조립=SG 목록 추가).
 * 2. 라벨/LOT 접두어(SG/FG/VH1-RM)면 대차 조회를 건너뛰어 낱개 스캔에 지연을 주지 않는다.
 * 3. 서버가 옵션 N·빈 대차·전표 미발행을 400으로 거르고, 화면은 메시지를 토스트로 보여준다.
 */
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "@/services/api";
import type { CarrierContentRow } from "./carrierTypes";

export function isLikelyLabelBarcode(raw: string): boolean {
  const v = raw.trim();
  return /^(SG|FG)\d/i.test(v) || /^VH1-RM/i.test(v);
}

export function useCarrierAutoInput(input: {
  equipCode: string | null | undefined;
  enabled: boolean;
  handleBarcode: (barcode: string) => Promise<boolean>;
}) {
  const { equipCode, enabled, handleBarcode } = input;
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);

  const isCarrierCandidate = useCallback((raw: string) => enabled && !!equipCode && !isLikelyLabelBarcode(raw), [enabled, equipCode]);

  /** @returns handled=false면 대차가 아니므로 호출자가 낱개 스캔으로 이어간다 */
  const run = useCallback(async (raw: string): Promise<{ handled: boolean; ok: number; fail: number }> => {
    const no = raw.trim();
    if (!isCarrierCandidate(no)) return { handled: false, ok: 0, fail: 0 };
    setRunning(true);
    try {
      const res = await api.get(`/production/carriers/${encodeURIComponent(no)}/auto-input`, { params: { equipCode }, suppressErrorModal: true });
      const rows: CarrierContentRow[] = res.data?.data?.rows ?? [];
      let ok = 0;
      let fail = 0;
      for (const row of rows) {
        const done = await handleBarcode(row.barcode);
        if (done) ok += 1; else fail += 1;
      }
      if (fail === 0) toast.success(t("carrier.autoInputDone", "대차 {{no}}: {{ok}}건 투입", { no, ok }));
      else toast.error(t("carrier.autoInputFailed", "대차 {{no}}: {{ok}}건 투입, {{fail}}건 실패", { no, ok, fail }));
      return { handled: true, ok, fail };
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 404) return { handled: false, ok: 0, fail: 0 };
      toast.error(message ?? t("carrier.notCarrier", "대차를 처리할 수 없습니다."));
      return { handled: true, ok: 0, fail: 0 };
    } finally {
      setRunning(false);
    }
  }, [equipCode, handleBarcode, isCarrierCandidate, t]);

  return { isCarrierCandidate, run, running };
}
```

`index.ts`:
```ts
export { default as OutputCarrierSlot } from "./OutputCarrierSlot";
export { default as CarrierSlipPrintModal } from "./CarrierSlipPrintModal";
export { useOutputCarrier, useCarrierProcessFlags } from "./useOutputCarrier";
export type { OutputCarrierState } from "./useOutputCarrier";
export { useCarrierAutoInput, isLikelyLabelBarcode } from "./useCarrierAutoInput";
export type { CarrierContentKind, CarrierContentRow, CarrierProcessFlags, CarrierSlipView, CarrierStatus, CarrierStatusView } from "./carrierTypes";
```

- [ ] **Step 7: i18n 최상위 `carrier` 블록 (4개 파일, `prepGuide` 블록 옆)**

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| slotLabel | 출력 대차 | Output carrier | 输出台车 | Xe đẩy đầu ra |
| scanPlaceholder | 대차 스캔 | Scan carrier | 扫描台车 | Quét xe đẩy |
| empty | 빈 대차 | Empty | 空车 | Trống |
| loaded | 적재 {{count}} | Loaded {{count}} | 已装 {{count}} | Đã xếp {{count}} |
| inTransit | 이동 중 | In transit | 转运中 | Đang chuyển |
| slip | 이동전표 | Transfer slip | 转运单 | Phiếu chuyển |
| clear | 대차 해제 | Release carrier | 解除台车 | Bỏ xe đẩy |
| capacityFull | 대차가 가득 찼습니다. 다른 대차를 스캔하세요. | Carrier is full. Scan another carrier. | 台车已满，请扫描其他台车。 | Xe đẩy đã đầy. Hãy quét xe khác. |
| autoInputDone | 대차 {{no}}: {{ok}}건 투입 | Carrier {{no}}: {{ok}} loaded | 台车 {{no}}：投入 {{ok}} 件 | Xe {{no}}: nạp {{ok}} |
| autoInputFailed | 대차 {{no}}: {{ok}}건 투입, {{fail}}건 실패 | Carrier {{no}}: {{ok}} loaded, {{fail}} failed | 台车 {{no}}：投入 {{ok}} 件，失败 {{fail}} 件 | Xe {{no}}: nạp {{ok}}, lỗi {{fail}} |
| notCarrier | 대차를 처리할 수 없습니다. | Cannot process carrier. | 无法处理台车。 | Không xử lý được xe đẩy. |
| slipTitle | 대차 이동전표 | Carrier Transfer Slip | 台车转运单 | Phiếu chuyển xe đẩy |
| slipNo | 전표번호 | Slip No. | 单号 | Số phiếu |
| from | 출발 공정 | From | 起始工序 | Từ công đoạn |
| to | 도착 공정 | To | 目标工序 | Đến công đoạn |
| toFinal | 최종 | Final | 最终 | Cuối |
| issuedAt | 발행 | Issued | 发行 | Phát hành |
| reprint | 재발행 | Reprint | 重印 | In lại |
| barcode | 바코드 | Barcode | 条码 | Mã vạch |
| loadedAt | 적재일시 | Loaded at | 装载时间 | Thời gian xếp |
| stepScan | 출력 대차 스캔 | Scan output carrier | 扫描输出台车 | Quét xe đẩy đầu ra |
| stepHint | 이 공정은 실적 라벨을 대차에 담습니다. 빈 대차 또는 같은 품목·작업지시의 대차를 스캔하세요. | This process loads result labels onto a carrier. Scan an empty carrier or one holding the same item and order. | 本工序将实绩标签装入台车。请扫描空车或同品目/同工单的台车。 | Công đoạn này xếp nhãn kết quả lên xe đẩy. Quét xe trống hoặc xe cùng mã hàng/lệnh. |

- [ ] **Step 8: 검증**

```powershell
node --test apps/frontend/src/components/shared/carrier/carrier.structure.test.mjs
pnpm.cmd run typecheck:frontend
```
Expected: 5 pass, 오류 0.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/components/shared/carrier apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F "$TEMP/cm.txt"   # "feat(shared): 출력 대차 슬롯·이동전표 인쇄·대차 자동투입 공용 모듈을 추가한다"
```
(신규 디렉터리라 디렉터리 단위 add 허용. 다른 세션 변경이 섞이지 않는지 `git status`로 먼저 확인.)

---

### Task 10: 세 화면 출력측 적용 + 준비 안내 단계

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx`, `components/EquipHeader.tsx`, `components/ProductionInputBar.tsx`, `components/KioskPrepGuideModal.tsx`, `utils/kioskPrepGuideSteps.ts`, `input-kiosk-prep-guide.structure.test.mjs`
- Modify: `apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx`, `page.structure.test.mjs`
- Modify: `apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx`, `components/AssemblyPrepGuideModal.tsx`, `assemblyPrepGuideSteps.ts`, `input-assembly-prep-guide.structure.test.mjs`
- Modify: 로케일 4개 — `kiosk.guide.stepCarrier/hintCarrier`, `production.inputAssembly.guide.stepCarrier/hintCarrier`

**Interfaces:**
- Consumes: `useCarrierProcessFlags`, `useOutputCarrier`, `OutputCarrierSlot` (Task 9); 실적/확정 API의 `carrierNo` (Task 8)
- Produces: 키오스크 `KioskGuideStepKey`에 `"carrier"`, 조립 `AssemblyGuideStepKey`에 `"carrier"`; `KioskGuideInput.carrierRequired: boolean, carrierNo: string | null`; `AssemblyGuideInput` 동일

- [ ] **Step 1: 구조 테스트 보강(실패)**

`input-kiosk-prep-guide.structure.test.mjs`에 추가:
```js
test('키오스크는 출력 대차 슬롯을 헤더에 두고 실적 저장에 carrierNo를 싣는다', () => {
  const page = read('./page.tsx');
  const header = read('./components/EquipHeader.tsx');
  const bar = read('./components/ProductionInputBar.tsx');
  const steps = read('./utils/kioskPrepGuideSteps.ts');
  assert.match(page, /useCarrierProcessFlags\(/);
  assert.match(page, /useOutputCarrier\(/);
  assert.match(header, /<OutputCarrierSlot/);
  assert.match(bar, /carrierNo: outputCarrierNo \?\? undefined/);
  assert.match(bar, /onCapacityRejected/);
  assert.match(steps, /"carrier"/);
  assert.match(steps, /notTarget: !carrierRequired/);
});
```
`input-assembly-prep-guide.structure.test.mjs`에 추가:
```js
test('조립 화면은 출력 대차 슬롯을 두고 확정에 carrierNo를 싣는다', () => {
  const page = read('./page.tsx');
  const steps = read('./assemblyPrepGuideSteps.ts');
  assert.match(page, /<OutputCarrierSlot/);
  assert.match(page, /carrierNo: outputCarrier\.carrier\?\.carrierNo \?\? undefined/);
  assert.match(steps, /"carrier"/);
});
```
`subprocess-kitting/page.structure.test.mjs`에 추가:
```js
test('서브조립 화면은 출력 대차 슬롯을 두고 확정에 carrierNo를 싣는다', () => {
  const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<OutputCarrierSlot/);
  assert.match(page, /carrierNo: outputCarrier\.carrier\?\.carrierNo \?\? undefined/);
});
```
(각 파일의 기존 `read` 헬퍼·import를 그대로 쓴다. 없으면 파일 상단 형식에 맞춰 `readFileSync`를 쓴다.)

- [ ] **Step 2: 실행해 실패 확인**

```powershell
node --test "apps/frontend/src/app/(authenticated)/production/input-kiosk/input-kiosk-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-assembly/input-assembly-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs"
```
Expected: 새 테스트 3건 FAIL.

- [ ] **Step 3: 가공(input-kiosk)**

`page.tsx`:
```ts
import { OutputCarrierSlot, useCarrierProcessFlags, useOutputCarrier } from "@/components/shared/carrier";
```
`allInterlockDone` 계산 아래:
```ts
  /** 출력 대차 — 공정 CARRIER_LOAD_YN=Y일 때만 슬롯이 보이고, 실적 저장에 carrierNo가 실린다 */
  const carrierFlags = useCarrierProcessFlags({ orderNo: selectedJobOrder?.orderNo, processCode: selectedEquip?.processCode });
  const carrierRequired = carrierFlags?.carrierLoadYn === "Y";
  const [equipCurCarrierNo, setEquipCurCarrierNo] = useState<string | null>(null);
  const outputCarrier = useOutputCarrier({ equipCode: selectedEquip?.equipCode, enabled: carrierRequired, initialCarrierNo: equipCurCarrierNo });
```
`restoreEquipmentCurrentState` 안에서 `const current = equipRes.data?.data ?? {};` 다음 줄에 `setEquipCurCarrierNo(current.curCarrierNo ?? null);` 추가, catch에서는 `setEquipCurCarrierNo(null)`.
guideSteps 입력에 `carrierRequired, carrierNo: outputCarrier.carrier?.carrierNo ?? null` 추가하고 deps에 둘 다 넣는다.
`<EquipHeader …>`에 `outputCarrier={outputCarrier}` 전달. `<ProductionInputBar …>`에 `outputCarrierNo={outputCarrier.carrier?.carrierNo ?? null}` `onCapacityRejected={outputCarrier.onCapacityRejected}` 전달(ProductionInputBar 렌더 위치는 page.tsx에서 `<ProductionInputBar`를 찾는다).
`<KioskPrepGuideModal …>`에 `onFocusCarrier={() => document.querySelector<HTMLInputElement>('[data-testid="carrier-slot-scan"] input, [data-testid="carrier-slot-scan"]')?.focus()}` 전달.

`components/EquipHeader.tsx`: props에 `outputCarrier?: OutputCarrierState;` 추가(import `type OutputCarrierState`, `OutputCarrierSlot` from `@/components/shared/carrier`). 준비 안내 버튼(`onOpenGuide &&` 블록) 바로 앞에:
```tsx
          {outputCarrier && <OutputCarrierSlot state={outputCarrier} compact />}
```

`components/ProductionInputBar.tsx`: props에 `outputCarrierNo: string | null; onCapacityRejected: () => void;` 추가. `handleSubmit`의 `api.post('/production/prod-results', {…})` 객체에 `carrierNo: outputCarrierNo ?? undefined,` 추가. catch 블록에 다음을 넣는다(기존 catch가 있으면 앞부분에 추가):
```ts
      } catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
        if (message.startsWith("대차 교체")) onCapacityRejected();
        // 나머지 오류 토스트는 공통 API 레이어가 띄운다
      }
```

`utils/kioskPrepGuideSteps.ts`: `KioskGuideStepKey`에 `| "carrier"`, `KioskGuideInput`에 `carrierRequired: boolean; carrierNo: string | null;`. raw 배열의 `workerInspect` 다음(자재 스캔 앞)에:
```ts
    { key: "carrier", done: Boolean(carrierNo), runnable: hasEquip && hasOrder, notTarget: !carrierRequired, detail: carrierNo ?? undefined },
```

`components/KioskPrepGuideModal.tsx`: props에 `onFocusCarrier: () => void;`, `STEP_ICON.carrier = ShoppingCart`(lucide import), `STEP_LABEL_KEY.carrier = "kiosk.guide.stepCarrier"`, `STEP_HINT_KEY.carrier = "kiosk.guide.hintCarrier"`, `openAction.carrier = onFocusCarrier`.

- [ ] **Step 4: 서브조립(subprocess-kitting)**

`page.tsx`:
```ts
import { OutputCarrierSlot, useCarrierProcessFlags, useOutputCarrier } from "@/components/shared/carrier";
```
상태 선언부 뒤:
```ts
  const carrierFlags = useCarrierProcessFlags({ orderNo: selectedOrder?.orderNo, processCode });
  const [equipCurCarrierNo, setEquipCurCarrierNo] = useState<string | null>(null);
  const outputCarrier = useOutputCarrier({ equipCode: equipCode || null, enabled: carrierFlags?.carrierLoadYn === "Y", initialCarrierNo: equipCurCarrierNo });
```
설비 선택 핸들러(L247 `setEquipCode(equip.equipCode)` 근처)에서 `/equipment/equips/:code` 응답을 이미 받고 있으면 `setEquipCurCarrierNo(data.curCarrierNo ?? null)`; 없으면 `api.get(\`/equipment/equips/${encodeURIComponent(equip.equipCode)}\`, { suppressErrorModal: true }).then(r => setEquipCurCarrierNo(r.data?.data?.curCarrierNo ?? null)).catch(() => setEquipCurCarrierNo(null))`. 초기화(L423 `setProcessCode("")`)에서 `setEquipCurCarrierNo(null)`.
헤더 작업자 버튼 블록 바로 뒤에 `<OutputCarrierSlot state={outputCarrier} />`.
`confirm-subkit` payload에 `carrierNo: outputCarrier.carrier?.carrierNo ?? undefined,`. 확정 catch에서 메시지가 `대차 교체`로 시작하면 `outputCarrier.onCapacityRejected()`. 확정 성공 후 `void outputCarrier.refresh();`.

- [ ] **Step 5: 조립(input-assembly)**

`page.tsx`: 같은 import. `interlock` 계산 뒤:
```ts
  const carrierFlags = useCarrierProcessFlags({ orderNo: selectedOrder?.orderNo, processCode });
  const carrierRequired = carrierFlags?.carrierLoadYn === "Y";
  const [equipCurCarrierNo, setEquipCurCarrierNo] = useState<string | null>(null);
  const outputCarrier = useOutputCarrier({ equipCode: equipCode || null, enabled: carrierRequired, initialCarrierNo: equipCurCarrierNo });
```
설비 선택(L161 `api.get(\`/equipment/equips/…\`)` 응답)에서 `setEquipCurCarrierNo(data.curCarrierNo ?? null)`. `resetAll`에서 `setEquipCurCarrierNo(null)`.
guideSteps 입력에 `carrierRequired, carrierNo: outputCarrier.carrier?.carrierNo ?? null` 추가(+deps). 준비 안내 버튼 앞에 `<OutputCarrierSlot state={outputCarrier} compact />`.
`confirm` payload에 `carrierNo: outputCarrier.carrier?.carrierNo ?? undefined,`. catch에서 `대차 교체` → `outputCarrier.onCapacityRejected()`. 성공 후 `void outputCarrier.refresh();`.
`<AssemblyPrepGuideModal …>`에 `onFocusCarrier={() => document.querySelector<HTMLInputElement>('[data-testid="carrier-slot-scan"] input, [data-testid="carrier-slot-scan"]')?.focus()}`.

`assemblyPrepGuideSteps.ts`: `AssemblyGuideStepKey`에 `| "carrier"`, `AssemblyGuideInput`에 `carrierRequired: boolean; carrierNo: string | null;`, raw 배열 끝에:
```ts
    { key: "carrier", done: Boolean(carrierNo), runnable: hasEquip && hasOrder, notTarget: !carrierRequired, detail: carrierNo ?? undefined },
```
`AssemblyPrepGuideModal.tsx`: props `onFocusCarrier`, 아이콘 `ShoppingCart`, 라벨 키 `production.inputAssembly.guide.stepCarrier`, 힌트 키 `production.inputAssembly.guide.hintCarrier`, action 매핑.

- [ ] **Step 6: i18n**

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| kiosk.guide.stepCarrier / production.inputAssembly.guide.stepCarrier | 출력 대차 스캔 | Scan output carrier | 扫描输出台车 | Quét xe đẩy đầu ra |
| kiosk.guide.hintCarrier / production.inputAssembly.guide.hintCarrier | 이 공정은 실적 라벨을 대차에 담습니다. 빈 대차 또는 같은 품목·작업지시의 대차를 스캔하세요. | This process loads result labels onto a carrier. Scan an empty carrier or one holding the same item and order. | 本工序将实绩标签装入台车。请扫描空车或同品目/同工单的台车。 | Công đoạn này xếp nhãn kết quả lên xe đẩy. Quét xe trống hoặc xe cùng mã hàng/lệnh. |

- [ ] **Step 7: 검증**

```powershell
node --test "apps/frontend/src/app/(authenticated)/production/input-kiosk/input-kiosk-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-assembly/input-assembly-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs"
pnpm.cmd run typecheck:frontend
```
Expected: 전부 pass, 오류 0. 브라우저 확인(claude-in-chrome, `http://localhost:3002/production/input-kiosk`): 라우팅에서 한 공정에 `대차 적재` 체크 → 그 공정 설비 선택 시 헤더에 슬롯이 보이고, 대차 미스캔 상태로 실적 저장하면 "출력 대차를 스캔하세요" 토스트, 대차 스캔 후 실적 저장하면 슬롯 적재수 증가, 이동전표 버튼으로 A4 미리보기까지 확인. 확인 결과(성공/실패)를 커밋 메시지 본문에 한 줄 남긴다.

- [ ] **Step 8: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/ProductionInputBar.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/KioskPrepGuideModal.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/utils/kioskPrepGuideSteps.ts" "apps/frontend/src/app/(authenticated)/production/input-kiosk/input-kiosk-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx" "apps/frontend/src/app/(authenticated)/production/input-assembly/components/AssemblyPrepGuideModal.tsx" "apps/frontend/src/app/(authenticated)/production/input-assembly/assemblyPrepGuideSteps.ts" "apps/frontend/src/app/(authenticated)/production/input-assembly/input-assembly-prep-guide.structure.test.mjs" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F "$TEMP/cm.txt"   # "feat(production): 가공·서브조립·조립 화면에 출력 대차 슬롯과 준비 안내 단계를 넣는다"
```

---

## 3단계 — 소비 시 해제·원자재 대차·입력측 자동투입·대차현황

### Task 11: 소비·취소 시 대차 해제 (백엔드)

**Files:**
- Modify: `apps/backend/src/modules/production/services/equip-material.service.ts` (mount: MAT 해제)
- Modify: `apps/backend/src/modules/production/services/subprocess-kitting.service.ts` (confirmAssembly L322 SG 소비, confirmSubKit L657 SG 소비 → 해제)
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts` (`reverseResultInTx`: FG 라벨 회수 시 해제. SG는 delete되므로 추가 작업 없음)
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts` (cancel: MAT 해제)
- Modify: `apps/backend/src/modules/production/production.module.ts`, `apps/backend/src/modules/material/material.module.ts` (`CarrierFlowService` 주입 경로 — MaterialModule은 ProductionModule을 import하거나 `CarrierFlowService`를 별도 `CarrierFlowModule`로 뺀다. 순환 import가 생기면 `CarrierFlowModule`(entities forFeature + TransactionService + NumberingService)을 신규로 만들어 Production/Material 두 모듈이 import한다)
- Test: `apps/backend/src/modules/production/services/carrier-release.spec.ts`

**Interfaces:**
- Consumes: `CarrierFlowService.clearInTx(qr, kind, barcodes, company, plant)`

- [ ] **Step 1: 테스트(실패) — mount가 MAT 해제를 호출한다**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EquipMaterialService } from './equip-material.service';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { WipMatStockService } from './wip-mat-stock.service';
import { ProcMatStockService } from '../../inventory/services/proc-mat-stock.service';
import { TransactionService } from '../../../shared/transaction.service';
import { CarrierFlowService } from './carrier-flow.service';

describe('EquipMaterialService.mount — 대차 해제', () => {
  it('장착 성공 시 MAT_LOTS 대차 컬럼을 비운다', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce({ equipCode: 'EQ1', processCode: 'P10' }).mockResolvedValueOnce(null),
      find: jest.fn().mockResolvedValue([]),
    };
    const tx = { run: jest.fn(async (cb: (qr: unknown) => Promise<unknown>) => cb({ manager })) };
    const carrierFlow = { clearInTx: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        EquipMaterialService,
        { provide: getRepositoryToken(WipMatStock), useValue: { manager } },
        { provide: getRepositoryToken(ItemMaster), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: WipMatStockService, useValue: { addStockInTx: jest.fn() } },
        { provide: ProcMatStockService, useValue: { findLot: jest.fn().mockResolvedValue({ itemCode: 'RM-1', availableQty: 100 }), deductStockInTx: jest.fn() } },
        { provide: TransactionService, useValue: tx },
        { provide: CarrierFlowService, useValue: carrierFlow },
      ],
    }).compile();
    const svc = module.get(EquipMaterialService);
    await svc.mount('EQ1', 'VH1-RM1', '40', '1000', 'W1');
    expect(carrierFlow.clearInTx).toHaveBeenCalledWith(expect.anything(), 'MAT', ['VH1-RM1'], '40', '1000');
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-release.spec.ts
```
Expected: FAIL (clearInTx 미호출 또는 주입 오류).

- [ ] **Step 3: 구현**

`equip-material.service.ts`: 생성자에 `private readonly carrierFlow: CarrierFlowService`. mount의 "5. 설비재고 가산" 다음:
```ts
      // 6. 키팅 대차에서 꺼낸다 — 장착되는 순간 LOT의 대차 소속을 비운다(설계 12절). 대차에 없던 LOT은 영향 없음.
      await this.carrierFlow.clearInTx(qr, 'MAT', [matUid], company, plant);
```
`subprocess-kitting.service.ts`: confirmAssembly의 SG 소비 루프(`sg.currentProcessCode = processCode; await qr.manager.save(SgLabel, sg);`) 뒤와 confirmSubKit의 같은 루프 뒤에 각각 한 번(루프 밖):
```ts
      // 입력 SG는 소비되는 순간 대차에서 꺼낸다(대차 스캔이든 낱개 스캔이든 같은 지점).
      await this.carrierFlow.clearInTx(qr, 'SG', sgLabels.map((s) => s.sgBarcode), company, plant);
```
(assembly는 `plan.allocations`로 소비한 라벨만: `[...new Set(plan.allocations.map((a) => a.sgBarcode))]`.)
`prod-result.service.ts` `reverseResultInTx`: `reverseProductStock` 호출 뒤에
```ts
    // 조립 실적 취소 — FG 라벨이 대차에 담겨 있었으면 꺼낸다(SG는 아래에서 delete되므로 별도 처리 없음)
    if (prodResult.prdUid) {
      await this.carrierFlow.clearInTx(queryRunner, 'FG', [prodResult.prdUid], company ?? prodResult.company, plant ?? prodResult.plant);
    }
```
`mat-issue.service.ts` cancel: 취소 대상 issue의 `matUid`로 트랜잭션 안에서 `await this.carrierFlow.clearInTx(qr, 'MAT', [issue.matUid], company, plant);` (cancel이 `tx.run`을 쓰면 그 qr, `dataSource.transaction`을 쓰면 그 manager를 가진 qr 대신 `qr.manager` 대체가 없으므로 `clearInTx`에 넘길 수 있는 `QueryRunner`를 얻는 기존 방식대로 맞춘다).

- [ ] **Step 4: 테스트·typecheck**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier-release.spec.ts src/modules/production/services/subprocess-kitting src/modules/production/services/prod-result src/modules/material/services/mat-issue
pnpm.cmd run typecheck:backend
```
Expected: 전부 pass(기존 spec의 provider 목록에 `CarrierFlowService` mock 추가 필요), 오류 0.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/production/services/equip-material.service.ts apps/backend/src/modules/production/services/subprocess-kitting.service.ts apps/backend/src/modules/production/services/prod-result.service.ts apps/backend/src/modules/material/services/mat-issue.service.ts apps/backend/src/modules/production/services/carrier-release.spec.ts apps/backend/src/modules/production/production.module.ts apps/backend/src/modules/material/material.module.ts
git commit -F "$TEMP/cm.txt"   # "feat(production,material): 라벨·LOT이 소비되거나 취소될 때 대차 소속을 비운다"
```
(변경한 spec 파일이 더 있으면 함께 add.)

---

### Task 12: 자재 출고 화면 — 선택형 대차 스캔

**Files:**
- Modify: `apps/backend/src/modules/material/dto/scan-issue.dto.ts`, `dto/mat-issue.dto.ts` (`CreateMatIssueDto`), `services/mat-issue.service.ts` (`scanIssue`→`createInTx` carrierNo 전달, LOT 스탬프)
- Modify: `apps/frontend/src/hooks/material/useBarcodeScan.ts`, `apps/frontend/src/app/(authenticated)/material/issue/components/IssueScanPanel.tsx`
- Test: `apps/backend/src/modules/material/services/mat-issue.carrier.spec.ts`, `apps/frontend/src/app/(authenticated)/material/issue/issue-carrier.structure.test.mjs`
- Modify: 로케일 4개 — `material.issue.carrierLabel`, `material.issue.carrierPlaceholder`, `material.issue.carrierHint`

**Interfaces:**
- Produces: `ScanIssueDto.carrierNo?: string`, `CreateMatIssueDto.carrierNo?: string`; 출고 시 `carrierNo`가 있으면 `CarrierFlowService.assertLoadableInTx({kind:'MAT', itemCode, orderNo:null, addCount:1})` 후 `stampInTx('MAT', [matUid])`

- [ ] **Step 1: 백엔드 spec(실패)**

```ts
import { CarrierFlowService } from '../../production/services/carrier-flow.service';
// mat-issue.service의 기존 spec 부트스트랩을 그대로 복사해 provider에 CarrierFlowService mock을 넣고, createInTx를 carrierNo 있이/없이 두 번 호출한다.
describe('MatIssueService.createInTx — 원자재 대차', () => {
  it('carrierNo가 있으면 출고 LOT에 대차를 찍고, 없으면 대차 서비스를 부르지 않는다', async () => {
    // arrange: carrierFlow = { assertLoadableInTx: jest.fn(), stampInTx: jest.fn() }
    // act: await service.createInTx(qr, { issueType: 'PRODUCTION', processCode: 'P10', items: [{ matUid: 'VH1-RM1', issueQty: 10 }], carrierNo: 'CR-K01' }, '40', '1000')
    // assert: expect(carrierFlow.stampInTx).toHaveBeenCalledWith(qr, 'MAT', ['VH1-RM1'], 'CR-K01', '40', '1000')
    // act2: 같은 dto에서 carrierNo 제거 → expect(carrierFlow.stampInTx).not.toHaveBeenCalled()
  });
});
```
(`mat-issue.service.spec.ts`가 이미 있으면 그 파일에 `describe` 블록을 추가하고 provider만 보강한다. 없으면 위 골격으로 새 파일을 만들되 기존 서비스의 생성자 의존성 전부를 `useValue: {}` 또는 최소 mock으로 채운다.)

- [ ] **Step 2: 실행해 실패 확인**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/material/services/mat-issue
```
Expected: 새 테스트 FAIL.

- [ ] **Step 3: 백엔드 구현**

두 DTO에:
```ts
  @ApiPropertyOptional({ description: '키팅 대차번호 (선택). 지정하면 출고 LOT을 그 대차에 담는다' })
  @IsOptional() @IsString() @MaxLength(30)
  carrierNo?: string;
```
`scanIssue`의 `createInTx(queryRunner, {…})` 호출 객체에 `carrierNo: dto.carrierNo,`. `createInTx`의 items 루프에서 재고 차감·공정재고 가산이 끝난 뒤(각 item):
```ts
      if (dto.carrierNo) {
        await this.carrierFlow.assertLoadableInTx(queryRunner, {
          carrierNo: dto.carrierNo, kind: 'MAT', itemCode: lot.itemCode, orderNo: null, addCount: 1, company: company ?? lot.company, plant: plant ?? lot.plant,
        });
        await this.carrierFlow.stampInTx(queryRunner, 'MAT', [lot.matUid], dto.carrierNo, company ?? lot.company, plant ?? lot.plant);
      }
```
생성자에 `private readonly carrierFlow: CarrierFlowService` 주입(Task 11의 모듈 구조 사용).

- [ ] **Step 4: 프론트 구조 테스트(실패)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./components/IssueScanPanel.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../../../../hooks/material/useBarcodeScan.ts', import.meta.url), 'utf8');

test('자재 출고 스캔에 선택형 키팅 대차 입력이 있고 출고 요청에 carrierNo가 실린다', () => {
  assert.match(panel, /data-testid="issue-carrier-input"/);
  assert.match(panel, /BarcodeScanInput/);
  assert.match(hook, /const \[carrierNo, setCarrierNo\] = useState\(''\)/);
  assert.match(hook, /carrierNo: carrierNo\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(panel, /disabled=\{[^}]*!carrierNo/);
});
```

- [ ] **Step 5: 프론트 구현**

`useBarcodeScan.ts`: `const [carrierNo, setCarrierNo] = useState('');` 추가, `handleIssue`의 post 객체에 `carrierNo: carrierNo.trim() || undefined,`, return에 `carrierNo, setCarrierNo`. `IssueScanPanel.tsx`: `useBarcodeScan()` 구조분해에 `carrierNo, setCarrierNo` 추가. `ProcessSelect` 아래에:
```tsx
        <div data-testid="issue-carrier-input">
          <BarcodeScanInput
            value={carrierNo}
            onChange={(v) => setCarrierNo(v.toUpperCase())}
            onScan={(v) => setCarrierNo(v.trim().toUpperCase())}
            placeholder={t('material.issue.carrierPlaceholder', { defaultValue: '키팅 대차 스캔 (선택)' })}
            label={t('material.issue.carrierLabel', { defaultValue: '키팅 대차' })}
            className="h-9 text-sm"
            fullWidth
            disabled={isScanning}
          />
          <p className="mt-1 text-[11px] text-text-muted">{t('material.issue.carrierHint', { defaultValue: '비우면 지금처럼 공정재고로만 출고됩니다. 대차를 찍으면 출고 LOT이 그 대차에 담깁니다.' })}</p>
        </div>
```
(`BarcodeScanInput`에 `label` prop이 없으면 위에 `<label className="block text-xs font-medium text-text mb-1">` 텍스트를 둔다.)

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| material.issue.carrierLabel | 키팅 대차 | Kitting carrier | 配料台车 | Xe đẩy kitting |
| material.issue.carrierPlaceholder | 키팅 대차 스캔 (선택) | Scan kitting carrier (optional) | 扫描配料台车（可选） | Quét xe kitting (tùy chọn) |
| material.issue.carrierHint | 비우면 지금처럼 공정재고로만 출고됩니다. 대차를 찍으면 출고 LOT이 그 대차에 담깁니다. | Leave empty to issue to process stock as before. Scan a carrier to load issued lots onto it. | 留空则仅出库到工序库存。扫描台车后出库批次装入该台车。 | Để trống thì xuất vào tồn công đoạn như trước. Quét xe để xếp lô xuất lên xe. |

- [ ] **Step 6: 검증**

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/material/services/mat-issue
node --test "apps/frontend/src/app/(authenticated)/material/issue/issue-carrier.structure.test.mjs"
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
```
Expected: 전부 pass, 오류 0.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/material/dto/scan-issue.dto.ts apps/backend/src/modules/material/dto/mat-issue.dto.ts apps/backend/src/modules/material/services/mat-issue.service.ts apps/frontend/src/hooks/material/useBarcodeScan.ts "apps/frontend/src/app/(authenticated)/material/issue/components/IssueScanPanel.tsx" "apps/frontend/src/app/(authenticated)/material/issue/issue-carrier.structure.test.mjs" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F "$TEMP/cm.txt"   # "feat(material): 자재 출고 시 키팅 대차를 선택 스캔해 출고 LOT을 대차에 담는다"
```
(백엔드 spec 파일도 add.)

---

### Task 13: 입력측 자동투입 — 세 화면

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialScanModal.tsx` (대차 스캔 → 장착 반복)
- Modify: `apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/InputSgScanPanel.tsx`, `apps/frontend/src/app/(authenticated)/production/input-assembly/components/SgScanPanel.tsx` (대차 스캔 → SG 추가 반복)
- Modify: 세 화면 page.tsx — 패널에 `equipCode`, `carrierAutoInput` prop 전달
- Test: 세 화면 구조 테스트에 케이스 추가

**Interfaces:**
- Consumes: `useCarrierAutoInput` (Task 9), `useCarrierProcessFlags`의 `carrierAutoInputYn`

- [ ] **Step 1: 구조 테스트 추가(실패)**

키오스크 테스트:
```js
test('자재 스캔 모달은 대차 스캔 시 담긴 LOT을 기존 장착 처리기로 반복 호출한다', () => {
  const modal = read('./components/MaterialScanModal.tsx');
  assert.match(modal, /useCarrierAutoInput\(/);
  assert.match(modal, /handleBarcode: mountOne/);
  assert.match(modal, /const handled = await carrierAuto\.run\(raw\)/);
  assert.doesNotMatch(modal, /\/production\/carriers\/[^`]*\/mount/, '대차용 별도 장착 API를 만들지 않는다');
});
```
서브조립·조립 테스트(각 파일):
```js
test('SG 스캔 패널은 대차 스캔 시 담긴 SG를 기존 낱개 처리기로 반복 추가한다', () => {
  const panel = readFileSync(new URL('./components/InputSgScanPanel.tsx', import.meta.url), 'utf8'); // 조립은 SgScanPanel.tsx
  assert.match(panel, /useCarrierAutoInput\(/);
  assert.match(panel, /handleBarcode: addOne/);
  assert.match(panel, /const handled = await carrierAuto\.run\(/);
});
```

- [ ] **Step 2: 실행해 실패 확인** — 세 테스트 파일 실행, 새 케이스 FAIL.

- [ ] **Step 3: 키오스크 MaterialScanModal**

props에 `equipCode: string | null; carrierAutoInputYn: boolean;` 추가(page.tsx에서 `equipCode={selectedEquip?.equipCode ?? null} carrierAutoInputYn={carrierFlags?.carrierAutoInputYn === "Y"}` 전달). 기존 `handleScan(rawMatUid?)` 내부의 장착 호출 부분을 `mountOne(matUid): Promise<boolean>`으로 분리한다:
```ts
  /** LOT 하나 장착 — 낱개 스캔과 대차 자동장착이 같은 함수를 쓴다 */
  const mountOne = useCallback(async (matUid: string): Promise<boolean> => {
    try {
      await api.post('/production/equip-material/mount', { equipCode: selectedEquip!.equipCode, matUid }, { skipSuccessToast: true });
      return true;
    } catch {
      return false; // 사유 토스트는 공통 API 레이어. 대차 반복에서는 건수만 집계한다
    }
  }, [selectedEquip]);
  const carrierAuto = useCarrierAutoInput({ equipCode, enabled: carrierAutoInputYn, handleBarcode: mountOne });
```
`handleScan`은 시작부에서:
```ts
    const raw = (rawMatUid ?? scanInput).trim();
    if (!raw) return;
    const { handled } = await carrierAuto.run(raw);
    if (handled) { setScanInput(''); await reloadMounted(); return; }
    // 이하 기존 낱개 장착 흐름 (mountOne 사용)
```
(`reloadMounted`는 모달이 장착 목록을 다시 불러오는 기존 함수명을 쓴다.) 기존 API 호출 시 `skipSuccessToast`를 쓰지 않았다면 낱개 경로에서는 성공 토스트를 그대로 유지하도록 `mountOne` 성공 뒤 `toast.success`를 호출자에서 띄운다.

- [ ] **Step 4: 서브조립 InputSgScanPanel / 조립 SgScanPanel**

props에 `equipCode: string; carrierAutoInputYn: boolean;` 추가(page.tsx에서 `equipCode={equipCode} carrierAutoInputYn={carrierFlags?.carrierAutoInputYn === "Y"}`). 기존 `handleScan(raw)`의 "SG 조회→검증→onAdd" 부분을 `addOne(barcode): Promise<boolean>`으로 분리(중복·잔량·상태·BOM 검증 그대로, 실패 시 토스트 후 false). `handleScan`은:
```ts
      const { handled } = await carrierAuto.run(trimmed);
      if (handled) { setScanInput(""); return; }
      const ok = await addOne(trimmed);
      if (ok) setScanInput("");
```
`const carrierAuto = useCarrierAutoInput({ equipCode, enabled: carrierAutoInputYn, handleBarcode: addOne });`. 대차 반복 중에는 `addOne`의 중복 검사가 `sgList` 스냅샷을 보므로, 같은 대차 안에 같은 바코드가 두 번 있을 수 없어 문제 없다(서버가 유니크).

- [ ] **Step 5: 검증**

```powershell
node --test "apps/frontend/src/app/(authenticated)/production/input-kiosk/input-kiosk-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-assembly/input-assembly-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs"
pnpm.cmd run typecheck:frontend
```
Expected: pass, 오류 0. 브라우저 E2E: (a) 자재 출고 화면에서 대차 CR-K01 찍고 LOT 2개 출고 → (b) 가공 키오스크(공정 자동투입 Y) 자재 스캔 모달에서 CR-K01 스캔 → "2건 투입" 토스트, 장착 목록 2건 → 대차현황(Task 14)에서 CR-K01이 EMPTY. (c) 가공 실적 → SG 라벨 대차 CR-001 적재 → 이동전표 발행 → 서브조립(자동투입 Y)에서 CR-001 스캔 → SG 목록에 추가. 전표 미발행 대차를 찍으면 "이동전표 미발행 대차" 토스트.

- [ ] **Step 6: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialScanModal.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/input-kiosk-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/InputSgScanPanel.tsx" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-assembly/components/SgScanPanel.tsx" "apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx" "apps/frontend/src/app/(authenticated)/production/input-assembly/input-assembly-prep-guide.structure.test.mjs"
git commit -F "$TEMP/cm.txt"   # "feat(production): 후공정에서 대차를 스캔하면 담긴 라벨·LOT을 기존 처리기로 일괄 투입한다"
```

---

### Task 14: 대차현황 화면 `/production/carrier-status`

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/carrier-status/page.tsx`, `carrierStatusColumns.tsx`, `CarrierContentsPanel.tsx`
- Test: `apps/frontend/src/app/(authenticated)/production/carrier-status/carrier-status.structure.test.mjs`
- Modify: 로케일 4개 — `production.carrierStatus` 블록

**Interfaces:**
- Consumes: `GET /production/carriers?carrierStatus&processCode&barcode&search&page&limit`, `GET /production/carriers/:no`, `CarrierSlipPrintModal`

- [ ] **Step 1: 구조 테스트(실패)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./carrierStatusColumns.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./CarrierContentsPanel.tsx', import.meta.url), 'utf8');
const locales = ['ko', 'en', 'zh', 'vi'].map((lang) => ({ lang, json: JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8')) }));

test('대차현황은 기본 필터가 활성(EMPTY 제외)이고 서버 페이징이다', () => {
  assert.match(page, /useState\("ACTIVE"\)/);
  assert.match(page, /carrierStatus: statusFilter/);
  assert.match(page, /ServerPager/);
  assert.match(page, /\/production\/carriers"/);
});

test('바코드로 대차 찾기 입력이 BarcodeScanInput이다', () => {
  assert.match(page, /BarcodeScanInput/);
  assert.match(page, /barcode: barcodeQuery/);
});

test('상태 배지는 ComCodeBadge(CARRIER_STATUS), page는 thin', () => {
  assert.match(columns, /<ComCodeBadge groupCode="CARRIER_STATUS"/);
  assert.match(columns, /export function createCarrierStatusColumns\(/);
  assert.doesNotMatch(page, /accessorKey:/);
  assert.match(panel, /CarrierSlipPrintModal/);
});

test('i18n production.carrierStatus 키', () => {
  for (const k of ['title', 'subtitle', 'findByBarcode', 'loadedCount', 'totalQty', 'lastLoadedAt', 'contents', 'noContents']) {
    for (const { lang, json } of locales) assert.ok(json.production?.carrierStatus?.[k], `${lang}: production.carrierStatus.${k} 누락`);
  }
});
```

- [ ] **Step 2: 실행해 실패 확인** — `node --test "apps/frontend/src/app/(authenticated)/production/carrier-status/carrier-status.structure.test.mjs"` FAIL.

- [ ] **Step 3: 컬럼**

```tsx
"use client";
/**
 * @file production/carrier-status/carrierStatusColumns.tsx
 * @description 대차현황 DataGrid 컬럼 — 상태/유형은 ComCodeBadge, 적재수는 "n/수용량".
 */
import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import { formatDateTime } from "@/utils/date";

export interface CarrierStatusRow {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: "EMPTY" | "LOADING" | "IN_TRANSIT";
  kind: "SG" | "FG" | "MAT" | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  lastLoadedAt: string | null;
}

export function createCarrierStatusColumns({ t }: { t: TFunction }): ColumnDef<CarrierStatusRow>[] {
  return [
    { accessorKey: "carrierNo", header: t("master.carrier.carrierNo"), size: 130, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono font-medium text-primary">{getValue() as string}</span> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="CARRIER_STATUS" align="center" />, size: 100,
      meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CARRIER_STATUS" code={getValue() as string} /> },
    { accessorKey: "carrierType", header: t("master.carrier.carrierType"), size: 100, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CARRIER_TYPE" code={getValue() as string} /> },
    { accessorKey: "kind", header: t("production.carrierStatus.kind"), size: 70, meta: { align: "center" as const },
      cell: ({ getValue }) => <span className="text-xs font-semibold">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 180 },
    { accessorKey: "orderNo", header: t("production.order.orderNo"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "loadProcessCode", header: t("production.carrierStatus.loadProcess"), size: 100 },
    { accessorKey: "loadedCount", header: t("production.carrierStatus.loadedCount"), size: 90, meta: { align: "right" as const },
      cell: ({ row }) => <span className="tabular-nums">{row.original.loadedCount}{row.original.capacity != null ? `/${row.original.capacity}` : ""}</span> },
    { accessorKey: "totalQty", header: t("production.carrierStatus.totalQty"), size: 90, meta: { align: "right" as const },
      cell: ({ getValue }) => <span className="tabular-nums">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "slipNo", header: t("carrier.slipNo"), size: 140, cell: ({ getValue }) => <span className="font-mono">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "lastLoadedAt", header: t("production.carrierStatus.lastLoadedAt"), size: 150, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
  ];
}
```
(`formatDateTime`이 `@/utils/date`에 없으면 그 파일에 있는 날짜시간 포맷 함수를 쓴다.)

- [ ] **Step 4: 내용 패널 + 페이지**

`CarrierContentsPanel.tsx`: props `{ carrierNo: string | null; onClose: () => void }`. 열리면 `GET /production/carriers/:no`로 `CarrierStatusView`를 받아 우측 패널(`w-[480px] … animate-slide-in-right`, 상단 액션: 닫기, 이동전표 버튼 → `CarrierSlipPrintModal`)에 헤더(대차번호·상태·품목·지시·다음 공정)와 내용 표(바코드·품목·수량·적재일시)를 그린다. 0건이면 `t("production.carrierStatus.noContents")`.

`page.tsx`: limit-sample page 뼈대. 상태 `statusFilter("ACTIVE")`, `processFilter("")`, `barcodeQuery("")`, `searchText("")`, `page`, `rows`, `total`, `selectedNo`. `fetchData`: `api.get("/production/carriers", { params: { page, limit: PAGE_SIZE, carrierStatus: statusFilter, ...(processFilter && { processCode: processFilter }), ...(barcodeQuery.trim() && { barcode: barcodeQuery.trim() }), ...(searchText.trim() && { search: searchText.trim() }) } })`. 툴바: 상태 `Select`(옵션: ACTIVE=t("production.carrierStatus.active"), EMPTY/LOADING/IN_TRANSIT은 `comCode.CARRIER_STATUS.*`), `ProcessSelect`, `BarcodeScanInput`(placeholder `production.carrierStatus.findByBarcode`, onScan→`setBarcodeQuery`), 검색 `Input`, `ServerPager`. 행 클릭 → `setSelectedNo(row.carrierNo)` → `<CarrierContentsPanel carrierNo={selectedNo} onClose={() => setSelectedNo(null)} />`. 새로고침 버튼. `sqlQuery`는 서비스의 UNION 집계 SQL 요약을 문자열로.

- [ ] **Step 5: i18n `production.carrierStatus` (4개 파일)**

| 키 | ko | en | zh | vi |
|---|---|---|---|---|
| title | 대차현황 | Carrier Status | 台车状态 | Tình trạng xe đẩy |
| subtitle | 대차별 현재 위치와 담긴 내용을 실시간으로 확인합니다. | See where each carrier is and what it holds in real time. | 实时查看各台车的位置与装载内容。 | Xem vị trí và nội dung từng xe đẩy theo thời gian thực. |
| active | 활성(빈 대차 제외) | Active (exclude empty) | 活动（不含空车） | Đang dùng (trừ xe trống) |
| findByBarcode | 바코드로 대차 찾기 | Find carrier by barcode | 按条码查找台车 | Tìm xe theo mã vạch |
| kind | 종류 | Kind | 种类 | Loại |
| loadProcess | 적재 공정 | Load process | 装载工序 | Công đoạn xếp |
| loadedCount | 적재수 | Loaded | 装载数 | Số lượng xếp |
| totalQty | 합계 수량 | Total qty | 合计数量 | Tổng SL |
| lastLoadedAt | 최근 적재 | Last loaded | 最近装载 | Xếp gần nhất |
| contents | 담긴 내용 | Contents | 装载内容 | Nội dung |
| noContents | 빈 대차입니다. | Carrier is empty. | 空车。 | Xe trống. |

- [ ] **Step 6: 검증**

```powershell
node --test "apps/frontend/src/app/(authenticated)/production/carrier-status/carrier-status.structure.test.mjs"
pnpm.cmd run typecheck:frontend
```
Expected: 4 pass, 오류 0. 브라우저로 `/production/carrier-status` 열어 목록·바코드 찾기·내용 패널·전표 재발행 확인.

- [ ] **Step 7: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/production/carrier-status/page.tsx" "apps/frontend/src/app/(authenticated)/production/carrier-status/carrierStatusColumns.tsx" "apps/frontend/src/app/(authenticated)/production/carrier-status/CarrierContentsPanel.tsx" "apps/frontend/src/app/(authenticated)/production/carrier-status/carrier-status.structure.test.mjs" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F "$TEMP/cm.txt"   # "feat(production): 대차별 위치·내용을 실시간으로 보는 대차현황 화면을 추가한다"
```

---

### Task 15: 최종 검증·도움말·미완료 기록

**Files:**
- Create: `apps/frontend/public/help/user/ko/MST_CARRIER.md`, `PROD_CARRIER_STATUS.md` (hanes-help-authoring 스킬 규격, `node tools/help-frontmatter-audit.mjs` 통과)
- Modify(있을 때만): `docs/reports/unfinished-work/2026-09-19-process-carrier-flow.md`

- [ ] **Step 1: 전체 검증**

```powershell
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier src/modules/master/services/carrier src/modules/master/services/routing-carrier-flag src/modules/material/services/mat-issue
node --test apps/frontend/src/components/shared/carrier/carrier.structure.test.mjs "apps/frontend/src/app/(authenticated)/master/carrier/carrier.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/carrier-status/carrier-status.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-kiosk/input-kiosk-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/input-assembly/input-assembly-prep-guide.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs" "apps/frontend/src/app/(authenticated)/material/issue/issue-carrier.structure.test.mjs" apps/frontend/src/config/menu-locale-coverage.structure.test.mjs
node scripts/find_missing_i18n.js
```
Expected: 전부 pass, 누락 i18n 0.

- [ ] **Step 2: 도움말 2건 작성** — `hanes-help-authoring` 스킬로 두 화면 도움말을 만들고 `node tools/help-frontmatter-audit.mjs` 통과.

- [ ] **Step 3: DB 실측 재확인**

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) FROM SG_LABELS WHERE CARRIER_NO IS NOT NULL"
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT CARRIER_NO, COUNT(*) FROM MAT_LOTS WHERE CARRIER_NO IS NOT NULL GROUP BY CARRIER_NO"
```
E2E 테스트로 남은 대차 소속이 있으면 실제 흐름(자동투입)으로 비우거나 사유를 기록한다.

- [ ] **Step 4: 미완료가 있으면 기록** — `docs/standards/unfinished-work-record.md` 기준으로 `docs/reports/unfinished-work/2026-09-19-process-carrier-flow.md` 작성(없으면 생략).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/public/help/user/ko/MST_CARRIER.md apps/frontend/public/help/user/ko/PROD_CARRIER_STATUS.md
git commit -F "$TEMP/cm.txt"   # "docs(help): 대차관리·대차현황 화면 도움말을 추가한다"
```

---

## Self-review 결과 (작성 시)

- 스펙 커버리지: 3-1/3-2 → Task 1·2, 3-3 → Task 3, 4절 → Task 7·8·10, 5절 → Task 7(issueSlip)·9(인쇄), 6절 → Task 7(getAutoInputRows)·9(훅)·13, 7절 → Task 11, 8절 백엔드 → Task 4·7, 8절 프론트 → Task 5·6·9·10·14, 9절 → 각 Task 테스트, 12절 → Task 11(mount 해제)·12·13(키오스크).
- 타입 일관성: `CarrierContentRow`/`CarrierStatusView`/`CarrierSlipView`는 백엔드(Task 7)와 프론트(Task 9) 필드가 같다(`loadedAt`은 백엔드 Date, 프론트 string). `assertLoadableInTx`/`stampInTx`/`clearInTx` 시그니처는 Task 7 정의를 Task 8·11·12가 그대로 쓴다. `useCarrierAutoInput.run`의 반환 `{ handled, ok, fail }`를 Task 13이 그대로 쓴다.
- 미결: MaterialModule↔ProductionModule 순환 시 `CarrierFlowModule` 분리(Task 11에 명시).
