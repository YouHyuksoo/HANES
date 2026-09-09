# 고객 감사지적 갭 보완 구현 계획

설계: `docs/specs/2026-09-09-customer-audit-gap-closure-design.md`
작업 ID: `T-CUSTOMER-AUDIT-GAPS`

병렬 트랙 5개로 나눈다. 공유 파일(locale 4개, 메뉴 4소스, entities/index.ts)은 트랙 간 충돌을 막기 위해 담당을 고정한다.

| 트랙 | 범위 | 공유 파일 담당 |
|---|---|---|
| A 생산·SPC | 1 설비점검 서버 게이트, 4 Cpk/Ppk | 없음 |
| B 자재 | 2 FIFO/만료, 3 출고요청 IQC | 없음(프론트 toast는 훅 1곳) |
| C 계측 | 5 VALUE_INDEX + 측정 수신 API | entities 변경은 기존 파일만 |
| D 마스터 | 6 압착규격, 7 검사보조구 | 메뉴 4소스, entities/index.ts, 도움말 |
| E 성적서 | 8 IQC 성적서 인쇄 | 없음 |
| 통합 | sys-config 마이그레이션, i18n 4파일 일괄, DB 적용, ERD, typecheck | 오케스트레이터 |

## 트랙 A

1. `production.module.ts`에 `EquipmentModule` import(순환 시 forwardRef).
2. `prod-result.service.ts`: `EquipInspectService`, `EquipInspectItemPool` 저장소 주입. `assertEquipInspectGate()` 추가, `create()`에서 자주검사 게이트 직후 호출.
3. jest: 설정 N 통과 / 풀 없음 통과 / 풀 있음+미점검 차단 / 점검완료 통과 / WORKER 유형.
4. `spc.service.ts` `calculateCpk()`: R̄/d2 군내 σ로 Cpk, 전체 σ로 Ppk. `hv-spc-math.ts` 상수 재사용. jest로 알려진 데이터셋 검증. `SPC_DATA.CPK/PPK`를 채우는 다른 경로가 있으면 같은 정의로 정렬(doubt).

## 트랙 B

1. `material/rules/fifo.rules.ts` + spec: `findOlderIssuableLot`, `isLotExpired`.
2. `mat-issue.service.ts`: `evaluateIssuePolicy()`(설정 3키 읽기, 후보 LOT 1쿼리), `createInTx`·`scanIssue`에 적용, 결과에 `warnings`.
3. `issue-request.service.ts`: `getAvailableStockQtyMap` → issuable/pendingIqc 2값, 상세 노출, `create` warnings, `approve` 정책 적용.
4. 프론트: 출고 응답 `warnings` toast(공통 지점), 출고요청 항목 그리드에 가용/미검사 컬럼.
5. jest: FIFO BLOCK/WARN, 만료 차단, 승인 BLOCK/WARN.

## 트랙 C

1. 마이그레이션 `2026-09-09_equip_protocol_value_index.sql` (ALTER ADD VALUE_INDEX, VALUE_UNIT, 멱등).
2. `equip-protocol.entity.ts`, 프로토콜 DTO, `continuity-inspect.service.ts` 파서에 `measuredValue`.
3. `quality/spc/controllers/measurement.controller.ts`, `services/measurement.service.ts`, DTO. 모듈 등록.
4. 프로토콜 화면(`inspection/protocol`)에 수치 인덱스/단위 입력 추가.
5. jest: 파서 수치 추출, 차트 없음 404, 설정 N 403, 정상 적재.

## 트랙 D

1. 마이그레이션 `2026-09-09_terminal_crimp_specs.sql`, `2026-09-09_inspect_aids.sql` (테이블·시퀀스·코멘트·공통코드 그룹 2개·메뉴 MERGE).
2. 엔티티 2개 + `entities/index.ts`.
3. master 모듈: 컨트롤러·서비스·DTO 2세트(이미지 업로드 multer 포함).
4. 프론트 화면 2개(`master/terminal-crimp-spec`, `master/inspect-aid`): page.tsx 얇게, columns 파일 분리, 폼 패널 컴포넌트, 구조 테스트 .mjs.
5. 메뉴 4소스 등록 + `pageRegistry.generated.ts` 재생성 스크립트 실행.
6. 도움말 `public/help/user/ko/QC_TERMINAL_CRIMP_SPEC.md`, `QC_INSPECT_AID.md`.
7. i18n 키는 목록으로 보고만(통합 단계에서 4파일 일괄 삽입).

## 트랙 E

1. `iqc-history/iqcDetailTypes.ts`로 DETAILS 파싱 타입 분리.
2. `IqcReportPrintModal.tsx` A4 양식.
3. `iqcHistoryColumns.tsx` 프린터 아이콘, `IqcDetailModal` 인쇄 버튼, page 상태 연결.
4. 구조 테스트 .mjs.

## 통합

1. `2026-09-09_audit_gap_sys_configs.sql`: `EQUIP_INSPECT_INTERLOCK`, `FIFO_ACTION`, `EXPIRED_ISSUE_BLOCK`, `MEASURE_RECEIVE_ENABLED` MERGE.
2. i18n 4파일 일괄 삽입(`scripts/apply_missing_i18n.js`) 후 `scripts/find_missing_i18n.js`로 0건 확인.
3. oracle-db connector로 JSHANES에 마이그레이션 4개 적용, pre/post 확인.
4. ERD 재생성, backend/frontend tsc, focused jest, 구조 테스트.
5. coordination JOURNAL/HANDOFF/REVIEW_QUEUE 갱신, 커밋(기능 / 협업문서 분리).
