# ARCHIVE

Completed tasks are compacted here to save context. Keep each item to one line.

Format:

```md
- T-000 | YYYY-MM-DD | owner | short result | evidence: JOURNAL heading or commit
```

## Completed

- T-ROUTING-PROCESS-TYPE-SOURCE | 2026-06-08 | codex | 라우팅 공정 추가 모달에서 공정유형 선택/저장 제거, 공정 마스터 `processType` 표시 전용으로 변경. 프론트 tsc·브라우저 모달 확인 통과 | evidence: JOURNAL 2026-06-08 15:11 codex
- T-IQC006-GROUP | 2026-06-08 | claude | IQC006 입하실적조회 좌측을 입하번호+PO+품번 그룹 1행으로 집계(시리얼당 펼침 해소), 우측 시리얼은 arrivalNo+품번 조회. cancel/manufacturer/getArrivalSerials seq→itemCode 그룹키 이전. 실DB 검증(R26060700001 10행→1행)·tsc 통과 | evidence: HANDOFF/claude.md 2026-06-08
- T-IQC-SAMPLE-BARCODE | 2026-06-08 | claude | IQC 검사결과 등록 모달에 시료 바코드(입력/스캔) 필드 추가. IQC_LOGS.SAMPLE_BARCODE 컬럼+엔티티+DTO+서비스+IqcModal+i18n4. tsc·DB컬럼 확인(end-to-end는 pending 0건 미검증) | evidence: HANDOFF/claude.md 2026-06-08
- T-MAT-RECEIVE-TESTDATA | 2026-06-08 | codex | `/material/receive` 정상 입고 테스트용 JSHANES 데이터 3건 생성: `RECV-TEST-260608-00003/00004/00005`, 입하 `RCVT26060800003`, 창고 `WH-MAT-A`, 화면 검색/체크박스 확인 | evidence: JOURNAL 2026-06-08 11:50 codex
- T-MAT-CYCLE-E2E-FIX | 2026-06-08 | codex | QA 결함 수정: 자재입고 창고 DTO 계약, IQC 성적서 업로드 UI, 날짜 표시/필터, 수동출고 체크박스 key, 재고 matUid 검색 보정. 스펙 53건·프론트/백엔드 tsc·헤드리스 브라우저 재확인 통과 | evidence: JOURNAL 2026-06-08 11:27 codex
- T-MAT-CYCLE-E2E-QA | 2026-06-08 | codex | PO `PO-260608-013`부터 입하 `R26060800001`, LOT `VH1-RM260608-00004`, IQC PASS, 입고 `RCV20260608-0001`, 출고 `ISS20260608-0001`, 재고 0/LOT DEPLETED까지 실데이터 검증. UI 결함 5건 확인 | evidence: JOURNAL 2026-06-08 codex
- T-LOT-SPLIT-MERGE | 2026-06-08 | claude | 자재분할/병합 재설계(#4·5·6): 원본 폐기(SPLIT/MERGED)→신규 시리얼 발번(분할 2조각/병합 통합1, nextMatSerial), 입고완료 게이팅(RECEIVE+분할·병합IN, 재가공 허용), 바코드 스캔 병합, STOCK_TX 채번, #4 currentQty 누락 해소. 회귀수정: IQC006 카운트 origin 필터, MAT_LOT_STATUS 공통코드 SPLIT/MERGED. tsc·jest16·API풀사이클·실DB 검증, 테스트데이터 원상복구 | evidence: HANDOFF/claude.md 2026-06-08
- T-AUDIT-COLUMN-DEFAULT-FIX | 2026-06-04 | claude | ORA-01400(ITEM_MASTERS.CREATED_AT NULL) 근본원인=TypeORM Oracle이 감사컬럼을 DB DEFAULT에 의존. 33개 테이블/64개 컬럼에 `DEFAULT SYSTIMESTAMP` 일괄 보정(멱등 마이그레이션) + create-hanes-schema.sql 실DB 실측 재생성(148 테이블) | evidence: JOURNAL 2026-06-04 claude
- T-BOM-LABEL-CLARIFY | 2026-06-02 | codex | BOM 화면 컬럼 라벨을 `품목유형`/`투입공정`으로 명확화해 `ITEM_TYPE`과 `BOM_MASTERS.OPER` 의미 구분 | evidence: JOURNAL 2026-06-02 13:13 codex
- T-ITEM-TYPE-COMCODE-UNIFY | 2026-06-02 | codex | `ITEM_MASTERS.ITEM_TYPE` 품목유형 공통코드 기준을 `ITEM_TYPE`으로 통일하고 JSHANES 주석/활성 코드/런타임 화면/schema SQL/ERD 정리 | evidence: JOURNAL 2026-06-02 12:55 codex
- T-BOM-PRODUCT-TYPE-SEMANTIC-FIX | 2026-06-02 | codex | `PRODUCT_TYPE`을 품목군 코드로 재정의해 `ITEM_TYPE`과 의미 중복 제거, JSHANES 데이터/DTO/프론트 옵션/시드 SQL 정정 | evidence: JOURNAL 2026-06-02 12:52 codex
- T-BOM-PRODUCT-TYPE-CLEANUP | 2026-06-02 | codex | `ITEM_TYPE`은 수불/생산 분류, `PRODUCT_TYPE`은 화면 제품유형 코드로 분리되도록 JSHANES 데이터와 DTO 검증 정렬 | evidence: JOURNAL 2026-06-02 12:35 codex
- T-BOM-PROD-SHEET-SEED | 2026-06-02 | codex | JSHANES `40/1000` BOM/품목/공정/라우팅 기준정보를 기존 데이터 삭제 후 `bom-from-production-sheet.html` 기준으로 재생성 | evidence: JOURNAL 2026-06-02 12:12 codex
- T-MASTER-ALL-DB-KEY-AUDIT | 2026-05-30 | codex | 기준정보 전체의 DB 키 기준 정리 완료, 임의 id 잔여 제거와 실제 DB 테이블명 표시 정정, 프론트 tsc 및 핵심 API 조회 통과 | evidence: JOURNAL 2026-05-30 11:10 codex
- T-MASTER-DB-KEY-CLEANUP | 2026-05-30 | codex | 기준정보 회사/사업장 화면에서 DB 응답에 없는 임의 id 의존 제거, 회사 복합키 `companyCode::plant` 기준 수정/삭제 호출로 정리 | evidence: JOURNAL 2026-05-30 10:52 codex
- T-DB-TYPEORM-SCHEMA-AUDIT | 2026-05-30 | codex | MYDBPDB/HNSMES 기준 TypeORM 엔티티 147개와 DB 테이블 147개 비교 완료, 모든 mismatch 0건으로 정리 및 ERD/감사 문서 갱신 | evidence: JOURNAL 2026-05-30 10:11 codex
- T-IQC-ARRIVAL-UNIT | 2026-05-29 | claude | IQC를 개별 시리얼 전수검사 → 입하번호+품목 단위 샘플검사로 재설계 (백엔드 pending-arrivals/arrival 엔드포인트 + 일괄판정/취소, 프론트 목록·모달, i18n 4파일) | evidence: 백엔드·프론트 빌드 통과
