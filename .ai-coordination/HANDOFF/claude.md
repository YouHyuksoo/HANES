# claude Handoff

## Last Update
2026-06-08

---

## ✅ 완료: 자재분할/병합 재설계 (T-LOT-SPLIT-MERGE, 2026-06-08)

spec: `docs/superpowers/specs/2026-06-08-lot-split-merge-redesign.md`. 사용자 결정 반영(재가공 허용 + 검증데이터 원상복구).

### 구현 (검증 완료)
- **분할** `lot-split.service.ts`: `findSplittableLots`에 입고완료 게이팅. `split()`=원본 전량 OUT→`SPLIT`(재고0, currentQty=0) + 신규 2조각(splitQty/잔량) `nextMatSerial`(오늘날짜) 발번, origin/arrival/expire 등 계승, **currentQty=조각수량(#4 ORA-01400 해소)**, 수불 LOT_SPLIT_OUT/IN(`next('STOCK_TX')`). 기존검증(예약·출고이력·HOLD·isSplittable) 유지. `newLotNo` DTO 제거.
- **병합** `lot-merge.service.ts`: `findMergeableLots` 게이팅 + `merge()`=동일 itemCode·origin 검증, 원시리얼 전부 OUT→`MERGED` + 신규 통합1개 발번(합산수량). `GET /material/lot-merge/by-barcode/:matUid`(바코드 단건 검증) 추가. `targetLotId` DTO 제거.
- **게이팅(사용자 결정=재가공 허용)**: 입고완료 = `SUM(QTY) WHERE TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') >= initQty`. 분할/병합 결과물도 재분할·재병합 가능.
- **프론트**: lot-split(id→matUid 버그수정, 분할결과 2건 라벨), lot-merge(**바코드 스캔 누적 UI**, 라벨). MatLabelPreviewModal 재사용. i18n 4파일.
- **회귀수정**: ① IQC006 카운트(`arrival.service` SERIAL/RECEIVED_COUNT_EXPR + getArrivalSerials)에 `(ORIGIN=MAT_UID OR ORIGIN IS NULL)` 필터 — 분할/병합 파생 시리얼이 입하라인 카운트 부풀리던 버그 해소. ② `MAT_LOT_STATUS` 공통코드에 SPLIT/MERGED 추가(`2026-06-08_mat_lot_status_split_merged.sql`, 회색조 safelist 색상).

### 검증
- tsc(백/프론트) 0건, jest 16건 통과(spec 재작성).
- API 풀사이클(실DB JSHANES): 입고전 차단 / RECEIVE 시드→분할목록 노출 / 분할(신규2·원본SPLIT·currentQty·수불) / 바코드조회 / 병합(통합1·원본MERGED) / 재가공 게이팅 / IQC006 부풀림 해소(seq=1 serialCount 4→1) 확인. 검증 테스트데이터 **원상복구 완료**.

### 잔여/주의 (다음 세션 점검 후보)
- mat-lot **LOT 이력 조회**(mat-lot.service findAll, status 옵셔널)는 SPLIT/MERGED도 표시됨(재고0, 이력성격이라 의도). 필요시 기본필터 검토.
- hold.service:113 `status==='DEPLETED'` 단독 차단 — SPLIT/MERGED HOLD 시도 가능(재고0이라 무해, 우선순위 낮음).

---

## 이번 세션 — T-MAT-RECV-FIXES (자재입고 프로세스 이슈, 행성 지적)

스테이크홀더(행성) 지적 목록 기반. 참조: 목업 `C:\Document\고객별프로젝트\행성사\THN_MockUp`(MT\IQC001~006), 채번 `HANES_MES_채번규칙.pptx`. 상세는 `JOURNAL.md` 2026-06-07, 설계는 `docs/superpowers/specs/2026-06-07-iqc006-arrival-result-design.md`.

### 완료 (검증됨)
- **#1 PO 등록 오류**: 근본원인=예외필터가 class-validator 배열 메시지 버림(앱전체 systemic). `http-exception.filter.ts` 배열 노출 + PO DTO 한글메시지/NotEmpty + 프론트 수량검증. API 재현으로 검증.
- **작업지시 품목 제품·반제품만**: `PartQueryDto.itemTypes` 다중 + `part.service` IN절 + `PartSearchModal.allowedItemTypes` + JobOrderFormPanel `["FINISHED","SEMI_PRODUCT"]`. API 검증.
- **#7 자재입고**: `/material/receive` 정상 동작 확인(미구현 아님). 사용자 결정=메뉴/흐름 개선(미착수).
- **#2 일부입하 배지**: DB attr1 Tailwind JIT purge → `app/globals.css` `@source inline` safelist. **브라우저 라이브 확인 완료**(일부입하 주황 배지 정상).
- **IQC006 입하실적조회 전체(Slice ①~④ + 프론트 + 메뉴 + i18n)**: API/브라우저 검증 완료. 신규 페이지 `/material/arrival-result`. (위 JOURNAL 상세)

---

## 다음 작업 (우선순위)

1. **#4·5·6 자재분할/병합 재설계 — 설계 승인 완료, 구현 대기**: 설계 spec `docs/superpowers/specs/2026-06-08-lot-split-merge-redesign.md` (사용자 승인: pptx 모델대로 / 분할=2분할 / 신규시리얼=오늘날짜). 핵심: 원 시리얼 전부 폐기→결과 전부 신규 발번(nextMatSerial), 입고완료 게이팅, 병합 바코드스캔, STOCK_TX 채번, 기존 검증 유지, 박스 범위외. **#4 분할 안 됨 실제 원인 확인=신규 MatLot insert가 currentQty 누락→MAT_LOTS.CURRENT_QTY NOT NULL 위반(500). 재작성 시 해소.** 영향: lot-split/lot-merge service+page, i18n 4파일.
2. **라인→공정별 작업설비 지정** (사용자: 이번 라운드 포함): 구조변경(라우팅/데이터모델). 별도 설계 필요.
3. (선택) #7 추가 개선: 비-admin 역할 ROLE_MENU_PERMISSIONS에 MAT_ARRIVAL_RESULT 추가(역할 관리), 자재수불 메뉴 순서 미세 정렬.

---

## 환경/검증 메모
- 백엔드 3003 (prefix `api/v1`), 프론트 3002, Oracle `JSHANES`(company=40/plant=1000).
- API 검증 인증: `Authorization: Bearer admin@hanes.com` + `X-Company:40` + `X-Plant:1000`.
- dev 서버 실행 중 `pnpm build` 금지. 타입체크 `pnpm --filter @harness/frontend exec tsc --noEmit`.
- `@source inline` 등 globals.css 변경은 Turbopack 재시작 필요.
- 활성 LOCK: T-MAT-RECV-FIXES (claude). 작업 계속 시 LOCKS.md 확인.

---

## 이전 세션 이월 (미완, 유효)
- ERD 문서 갱신(`python tools/generate_db_schema_doc.py`), T-015 ERP PO Interface(IF_PO), notifications unread-count 간헐 500.
- Phase B 생산/품질(초중종물, 직접/의뢰검사), Phase C 영업(인계→출하지시→출하), Phase D 수리.
