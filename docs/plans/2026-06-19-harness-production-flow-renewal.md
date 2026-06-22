# 하네스 생산흐름·수불·추적성 리뉴얼 마스터 계획

> **For agentic workers:** 이 문서는 마스터 설계 + 단계 계획이다. 각 Phase는 실행 직전에 `superpowers:writing-plans`로 **bite-sized 상세 sub-plan**을 별도 작성한 뒤 `superpowers:subagent-driven-development`로 구현한다. 본 문서 단독으로 코드를 작성하지 말 것 — 미결(OPEN) 항목이 확정되어야 한다.

**Goal:** 원자재 투입 → 반제품(묶음) → 서브공정 수렴 → 제품 → 검사 → 포장 → 출하 전 과정을, 재고는 `PRODUCT_STOCKS` 한 곳에서 수량으로, 추적은 라벨 패밀리(`FG_LABELS`/`SG_LABELS`)로 일관되게 처리하도록 재구성한다.

**Architecture:** 재고(수량)와 추적(시리얼)을 역할 분리한다. `PRODUCT_STOCKS`는 품목코드+창고 수량만(시리얼 제거), 시리얼·상태·추적은 `FG_LABELS`(완제품, qty=1)·`SG_LABELS`(반제품 묶음, 잔량 보유)가 담당한다. 제품라벨 발행 시점을 통전검사 → 서브공정으로 앞당겨 서브공정~출하 단일 키를 만든다.

**Tech Stack:** NestJS + TypeORM(Oracle), Next.js(3002), pnpm/Turborepo, Oracle SEQUENCE 채번, 구조 테스트(`*.structure.test.mjs`) + 실DB(JSHANES) 검증.

---

## 0. 확정된 설계 (LOCKED — grill 합의)

### 공정/작업지시
- 작업지시 = BOM 레벨 부모(완제품)/자식(반제품), 각자 라우팅 보유. 공정 순서는 **라우팅**이 정의(BOM.OPER 사용 안 함).
- **추적라벨(묶음)** 은 최초 공정에서 1회 발행 → 서브공정 직전까지 **동일 시리얼로 이동**. 공정마다 재발행하지 않음.
- **서브공정** = 여러 묶음에서 1가닥씩 **스캔 소비** → **제품라벨 발행**. 이후 배판 → [하우징] → 통전검사 → 외관검사 → 포장 → 출하.
- 서브공정은 "완제품"이 아니다(제품라벨이 붙는 지점일 뿐, 이후 공정 더 있음). 라우팅 가변(배판으로 끝나거나 하우징 추가).

### 자재·공정재고·수불
- 원자재 lifecycle: `창고출고(수불) → 이동중(미장착) → 장착(상태전이) → 실적소비(수불)`.
  - 출고 = `원자재창고 OUT` + `공정 IN` 2건 수불.
  - 장착 = 설비 단위, BOM 화이트리스트 검증, **수불 없이 상태 전이만**.
  - 잔량(출고>소비) 처분 = **반납·이월 둘 다 선택** 가능.
- 묶음(반제품) lifecycle: `생산실적(공정재고 입고 수불) → 장착(상태전이) → 서브공정 소비(차감 수불)`.
  - 이동중 없음. 생산실적 시 그 공정에 실적+공정재고 동시 발생. 뒷공정 장착 시 이전공정에서 빠져 뒷공정으로 위치 이동(추적라벨 행의 위치 변경, 수불 X).
- 실적 입력은 묶음 단위: `소비량 = 실적 묶음수 × 묶음당수량 × BOM QTY_PER`.
- 묶음당 가닥 소비 최소 단위 = 1가닥.

### 재고/추적 분리 (핵심)
- **재고 수량 = `PRODUCT_STOCKS` 한 곳.** 완제품(FG 창고)·반제품(WIP 창고) 모두 **품목코드+창고 수량**. `PRD_UID` 시리얼·`'*'`·배치시리얼 **제거**. 신규 재고 테이블 없음.
- **추적 시리얼 = 라벨 패밀리:**
  - `FG_LABELS` — 완제품 제품라벨, qty=1, 상태/BOX_NO/추적.
  - `SG_LABELS`(신규) — 반제품 묶음 추적라벨, **잔량(가닥수) 보유**, 상태/위치/장착설비/genealogy.
- 제품라벨 발행 시점: **통전검사 → 서브공정으로 이전**. 통전/외관은 발행이 아니라 상태(합/불) 갱신.
- 단일 키 효과: 제품라벨이 서브공정부터 존재 → FG재고·박스·출하를 제품라벨로 키잉 → 기존 `'*'`/수량 FIFO 우회 **제거**.
- 추적성: **Full as-built**, 제품 → 묶음 → 원자재 lot, **스캔 기반**(서브공정에서 묶음·개별 원자재 LOT 스캔).
- 동기화 규칙: 라벨 이벤트 시 같은 트랜잭션에서 `PRODUCT_STOCKS` 수량 +/− 갱신. 정합 기준은 라벨(완제품 `qty=COUNT(FG_LABELS 재고분)`, 반제품 `qty=SUM(SG_LABELS.잔량)`). 어긋나면 라벨 기준 보정.
- (원자재 재고는 도메인이 달라 기존 `MAT_STOCKS`/`WIP_MAT_STOCKS` 유지. "재고 일관"은 제품·반제품 = `PRODUCT_STOCKS` 범위.)

---

## 1. 확정된 결정 (RESOLVED 2026-06-19 — grill 완료, LOCKED)

### O-1. 제품 단계 수불 이벤트 (LOCKED)
- **서브공정:** (1) **묶음(반제품) 소비**(가닥 스캔, 공정 OUT 수불) + (2) **개별 원자재 직접 투입 소비**(서브공정 설비 장착분 BOM 차감, 소비 수불) + (3) 제품라벨 발행 → **제품 WIP 창고 PRODUCT_STOCKS +1**(재공 입고 수불). 묶음·원자재 lot 모두 genealogy 기록.
- **배판/하우징:** 생산실적 공정과 동일(자재 장착 + 실적). 추가 자재 투입분 **BOM 차감 수불**, 제품 수량 불변. **초중종물 검사 없음**.
- **통전/외관:** 상태(합/불) 갱신만, 수불 X.
- **포장(담기):** 박스 만들고 제품 스캔해 담기. **여전히 WIP 창고**(수불 X). BOX_NO 스탬프 + PACKED.
- **박스 FG 입고:** 포장 끝난 박스를 **스캔해 FG 창고로 이동** → 박스 안 제품 수불(WIP OUT / FG IN). (현행 박스 마감→박스 입고 2단계와 일치)
- **출하:** FG 출고 수불 + 제품라벨 SHIPPED.
- 공정 간 이동은 제품라벨 STATUS/현재공정 컬럼으로 표현(이동 수불 미생성).

### O-2. 불량·재작업 (LOCKED)
- 불량은 **모든 공정 실적에서** 잡힘(통전/외관 포함). **불량수량은 가닥 단위, 묶음 수량과 무관**.
- 묶음 불량: 통째 또는 부분(가닥). 폐기 시 **불량창고 입고 수불** + 수량/잔량 차감.
- 제품 불량: **현행 `repair` 모듈 재사용**. 원칙 ①제품라벨 유지 ②폐기 시 불량창고 입고.
- 라벨 정책: **원라벨 유지(추적 연속성)**, **라벨 훼손 시에만 재발행**(REPLACED_BY).

### O-3. 라우팅/공정 마스터 (LOCKED)
- 신규 공정(서브공정/배판/하우징)은 **공정 마스터 + 라우팅 데이터로 등록**(하드코딩 아님).
- 라벨 발행 트리거는 **라우팅이 결정** → `ROUTING_PROCESSES`에 발행 플래그 추가(`ISSUE_SG_LABEL_YN`/`ISSUE_FG_LABEL_YN`).
- 반제품 라우팅 발행공정 → 묶음 라벨, 완제품 라우팅 서브공정 → 제품 라벨.

### O-4. 화면 (LOCKED)
- **신규 핵심:** **서브공정 키팅 실적 화면**(묶음·원자재 LOT 스캔 → 제품라벨 발행 + genealogy).
- **재사용/참조:** 기존 **생산실적 키오스크**(`production/input-kiosk`) = 반제품 최초~중간 공정용(초중종물 검사 포함, 자재 수불 컨셉 일부 반영). 신모델(묶음 발행/SG_LABELS) 반영만 조정.
- **변경:** 통전/외관(발행 제거→상태 갱신), 포장/박스입고, 출하(단일키), 공정재고/제품재고 조회, 자재 출고/장착·탈착(반납·이월).
- **신규 조회:** 묶음(추적라벨) 조회, 제품 추적조회(역/정추적).
- 우선순위(추천): 서브공정 키팅 → 생산실적 키오스크 조정 → 장착/탈착 → 조회/추적 → 검사·포장·출하.

### O-5. 마이그레이션 (LOCKED)
- **컷오버:** 신규 작업지시부터 신모델, 기존 진행분은 소진(완료)까지 현행 유지.
- **기존 데이터는 전량 정리 가능**(불필요한 테스트성 데이터) → 변환 로직 불필요. `PRODUCT_STOCKS` `'*'`/배치시리얼 등 정리 후 신모델로 시작.
- **DB 중단 허용**, **`oracle-db` 스킬**로 DDL/정리 수행. DDL 후 의존 PL/SQL 컴파일.
- `SG_LABELS`·genealogy·시퀀스는 신규 생성(비파괴, Phase 1).

---

## 2. File / Object Structure (변경 지도)

### DB (Oracle, JSHANES)
- **신규** `SG_LABELS` — 반제품 묶음 추적라벨(시리얼 PK, 품목, 잔량, 상태, 위치/장착설비, 발행공정, 작업지시, COMPANY/PLANT_CD, 감사컬럼). 시퀀스 `SEQ_SG_LABEL`.
- **신규** genealogy 링크 테이블(가칭 `PRODUCT_GENEALOGY`) — `(제품라벨, 소스타입, 소스시리얼/LOT, 회로/포지션)`. 제품 → 묶음/원자재 lot 연결.
- **변경** `PRODUCT_STOCKS` — `PRD_UID` 시리얼 사용 폐기(품목코드+창고 수량). PK 재정의 검토 + 데이터 마이그레이션.
- **변경** `FG_LABELS` — 발행 시점 이전에 따른 상태머신 보정(서브공정 발행 → 통전/외관 상태 갱신).
- **검토** `ROUTING_PROCESSES` — 라벨 발행 시점/공정유형 속성 추가(O-3).
- DDL 적용 후 의존 PL/SQL `ALTER ... COMPILE`(ORA-04068 예방).

### Backend (apps/backend/src)
- `entities/sg-label.entity.ts`(신규), `entities/product-genealogy.entity.ts`(신규)
- `entities/product-stock.entity.ts`(PRD_UID 정리)
- `modules/production/services/prod-result.service.ts`(묶음 발행/소비, 수불 재작성)
- `modules/production/services/auto-issue.service.ts`(출고·장착·소비 흐름)
- `modules/inventory/services/product-inventory.service.ts`(시리얼 키 제거, 수량 일원화, '*'·FIFO 우회 제거)
- `modules/quality/continuity-inspect/services/continuity-inspect.service.ts`(FG_BARCODE 발행 제거 → 상태 갱신)
- `shared/numbering.service.ts`(SG 라벨 채번 추가)
- 서브공정 키팅 컨트롤러/서비스(신규)

### Frontend (apps/frontend/src)
- 묶음 발행/장착/탈착/키팅 스캔/추적조회 화면(O-4) + 기존 화면 반영
- `config/menuConfig.ts`, `pageRegistry.generated.ts`, i18n 4종

---

## 3. 단계 계획 (Phases — 각 Phase는 실행 직전 상세 sub-plan 작성)

순서는 **위험 격리 + 비파괴 우선**. 각 Phase 종료 시 `tsc`/구조 테스트/JSHANES 실측으로 검증, coordination 보드 lock.

- **Phase 0 — 설계 확정:** ✅ 완료(2026-06-19). O-1~O-5 확정(§1). 남은 산출물: ERD/상태머신/수불 매트릭스 문서화(실행 착수 시).
- **Phase 1 — `SG_LABELS`/genealogy 스키마(비파괴 추가):** 신규 테이블·시퀀스·엔티티. 기존 흐름 영향 없음. 단위/구조 테스트.
- **Phase 2 — 채번·발행 + 키팅 엔진:** ✅ 완료(2026-06-19). 라우팅 플래그, SG 묶음 발행(prod-result), 서브공정 키팅 API(SG소비→FG발행→genealogy→WIP재고/수불), FG 발행 ON_SUBPROCESS 분기, 생산관리 키팅 메뉴/화면. 실증(실DB) PASS.
- **Phase 3 — 자재 출고·장착·소비 수불 재작성:** 출고 2건 수불, 이동중/장착 상태, 잔량 반납/이월, 묶음 소비(스캔) + genealogy 기록.
- **Phase 4 — 재고 일원화 + 마이그레이션:** `PRODUCT_STOCKS` 시리얼 제거, 수량 동기화 규칙, **기존 데이터 전량 정리(변환 불필요)** — `oracle-db` 스킬로 DB 중단 후 정리. `'*'`/수량 FIFO 우회 제거. 컷오버(신규부터 신모델).
- **Phase 5 — 검사·포장·출하 단일키 전환:** 제품라벨 단일키로 박스/출하 정리, 기존 우회 코드 제거, 회귀 검증.
- **Phase 6 — 화면:** O-4 화면별 sub-plan(각각 독립 작업·검증).
- **Phase 7 — 정합/회귀:** 라벨↔재고 정합 점검 배치, 전 구간 E2E(생산→출하) 실측, 불량·재작업 경로(O-2).

### Phase별 검증 기준(공통)
- 백엔드: `pnpm --filter @harness/backend exec tsc --noEmit` 0건 + 서비스 spec.
- 프론트: 구조 테스트 + `pnpm --filter @harness/frontend exec tsc --noEmit` 0건.
- 실DB: JSHANES에 DDL/시드 적용, API·브라우저(3002) 실측, 테스트 데이터 원복.
- DB 변경 후 의존 PL/SQL 컴파일 확인.

---

## 4. 리스크 / 운영 주의
- **라이브 데이터 마이그레이션**(JSHANES, 배포서버와 DB 공유) — 백업·롤백 필수, 사용자 승인 후 적용.
- **공유 모듈 재작성**(prod-result/inventory/shipping) — coordination LOCKS 등록, 다른 AI 세션과 충돌 방지.
- **단계적 전환** — Phase 1~2는 비파괴 추가, 파괴적 변경(Phase 4)은 우회 제거와 함께 한 번에.
- push는 사용자 명시 지시 시에만.

---

## 5. 자기 점검 (writing-plans self-review)
- Spec 커버리지: 확정 설계(§0) 전 항목이 Phase 1~7에 매핑됨. 미결(§1)은 Phase 0에서 닫음.
- 본 문서는 **마스터/단계 계획**이므로 bite-sized 코드 단계는 각 Phase sub-plan에서 작성(스킬의 multi-subsystem 분할 지침 적용).
- 타입/명명 일관성: `SG_LABELS`(반제품)·`FG_LABELS`(완제품)·`PRODUCT_STOCKS`(수량) 역할 고정.
