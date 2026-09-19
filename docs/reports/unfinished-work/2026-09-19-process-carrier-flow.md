# 미완료 작업 기록: 공정 대차(운반구) 흐름

- 작성시각: 2026-09-19 19:40 KST
- 작성자: claude (Task 15 — 최종 검증·도움말·미완료 기록)
- 작업 범위: `docs/specs/2026-09-19-process-carrier-flow-design.md` 전체(Task 1~15). 대차 마스터, 공정 대차 플래그, 출력 대차 슬롯(가공/서브조립/조립), 자재 출고 키팅 대차, 대차현황 화면, 대차 자동투입
- 현재 상태: 검증대기 (코드·타입·단위테스트·DB 실측은 통과, 브라우저 실화면 E2E는 전 세션에서 미확인)

## 완료한 것

- DB 오브젝트/엔티티: `CARRIER_MASTERS`, `ROUTING_PROCESSES.CARRIER_LOAD_YN`/`CARRIER_AUTO_INPUT_YN`, `SG_LABELS`/`FG_LABELS`/`MAT_LOTS.CARRIER_NO` 컬럼(+엔티티 매핑)
- 백엔드: `/master/carriers`(CRUD) API, `/production/carriers`(status/select/slip/auto-input/release/list) API, `carrier-flow.service`(assertLoadableInTx/stampInTx/clearInTx), 자재 출고 서비스의 선택형 키팅 대차 입력
- 프론트 공용 모듈 `apps/frontend/src/components/shared/carrier/`: 타입(`carrierTypes.ts`), 출력 슬롯 훅(`useOutputCarrier`), 자동투입 훅(`useCarrierAutoInput`), 출력 슬롯 UI(`OutputCarrierSlot`), 전표 인쇄 모달(`CarrierSlipPrintModal`)
- 화면: `/master/carrier`(대차 마스터, QR 라벨), `/production/carrier-status`(대차현황), 가공 키오스크·서브조립·조립 3화면의 출력 대차 슬롯 + 준비 안내(prep-guide) 단계, 자재 출고 화면의 선택형 키팅 대차 스캔
- i18n: `master.carrier.*`, `production.carrierStatus.*`, `carrier.*`, `master.routing.carrier*`, `production.inputAssembly.guide`, `kiosk.guide` 등 4개 로케일(ko/en/zh/vi) 완비. 이번 세션에서 `comCode.CARRIER_TYPE.{CART,TRAY,MAGAZINE}`, `comCode.CARRIER_STATUS.{EMPTY,LOADING,IN_TRANSIT}` 6키를 4개 로케일에 추가로 반영(공통코드 배지 라벨)
- 도움말: `apps/frontend/public/help/user/ko/MST_CARRIER.md`, `PROD_CARRIER_STATUS.md` 신규 작성(hanes-help-authoring 규격), `apps/frontend/public/help/manifest.json`에 `MST_CARRIER`/`PROD_CARRIER_STATUS` 항목 추가
- 검증 명령 전부 통과(아래 "검증 상태" 참조)

## 미완료 / 남은 것

### 브라우저 실화면 E2E 검증 (모든 구현 세션에서 브라우저 도구 미제공으로 수행 못함)

아래를 실제 로그인 세션에서 순서대로 확인해야 한다.

1. **대차관리(`/master/carrier`)**
   - 대차 신규 등록(대차번호/유형/수용량) → 저장 → 목록 반영 확인
   - 행 클릭 → 수정 패널에 값 채워짐, 대차번호 잠김 확인
   - QR 라벨 모달 열기 → 인쇄 미리보기에서 QR 값이 대차번호와 일치하는지 확인
   - 사용여부 N으로 바꾼 대차가 생산 화면 스캔에서 거부되는지 확인
   - 삭제 확인 모달 → 삭제 후 목록에서 사라짐 확인
2. **라우팅 관리(`/master/routing`)**
   - 공정별 "대차 적재(출력측)"·"대차 자동투입(입력측)" 체크박스 저장/재조회
   - `issueLabelType=NONE`일 때 "대차 적재" 체크박스가 비활성화되는지 확인
3. **가공 실적입력(키오스크, `/production/input-kiosk`)**
   - "대차 적재" 켜진 공정에서 헤더 출력 대차 슬롯에 빈 대차 스캔 → 적재 중 표시
   - 실적 저장 시 라벨이 대차에 담기는지, 수용량 초과 시 저장이 막히는지 확인
   - 이동전표 발행 → 대차 해제(슬롯 비워짐) 확인
   - "대차 자동투입" 켜진 공정에서 대차번호를 자재/라벨 스캔칸에 스캔 → 담긴 항목이 순차로 장착 처리되는지 확인
4. **서브조립 실적입력(`/production/subprocess-kitting`)**
   - 출력 대차 슬롯 동작(위와 동일), SG 스캔 패널에서 대차 스캔 시 담긴 SG가 반복 추가되는지 확인
5. **조립 실적입력(`/production/input-assembly`)**
   - 출력 대차 슬롯 동작, SG 스캔 패널 대차 자동투입 동작 확인
6. **자재 출고(`/material/issue`)**
   - 선택형 키팅 대차 스캔 → 출고 LOT의 `CARRIER_NO`가 실제로 찍히는지 확인
7. **대차현황(`/production/carrier-status`)**
   - 기본 필터(활성, 빈 대차 제외) 동작, 상태·공정·바코드·검색 필터 조합
   - 위 1~6에서 만든 대차가 목록/상세에 실제로 반영되는지(품목/수량/전표번호/다음 공정)
   - 상세 패널 "이동전표" 버튼으로 재발행 → 목록이 갱신되는지(`onChanged` 콜백)

이번 세션에서 DB를 재확인한 결과 `CARRIER_MASTERS`에 등록된 대차가 0건이고 `SG_LABELS`/`FG_LABELS`/`MAT_LOTS`에 `CARRIER_NO`가 찍힌 행도 0건이다. 즉 실사용 이력이 전혀 없어 위 체크리스트 전체가 미검증 상태다.

### 후속 개선 후보 (구현 세션 self-review, 동작에는 영향 없음)

- 대차 삭제가 담긴 라벨/LOT 참조 검증 없이 물리 삭제
- CARRIER_LOAD_YN=Y인데 ISSUE_LABEL_TYPE=FG인 가공 공정은 대차 스캔만 강제되고 스탬프 없음(라우팅 검증을 SG/BUNDLE로 좁힐지 검토)
- subprocess-kitting 라우팅 step 조회 routingCode null 가드 없음(2곳), confirmAssembly step 중복 조회 1회, 스탬프 배선 회귀 테스트 없음
- carrier-release.spec이 qr를 expect.anything()로 검사, FG/MAT clear 호출부 스펙 없음
- mat-issue 대차 스펙이 issueType OTHER·단일 item만 커버
- 키오스크 대차 루프 재조회 GET 2N회, 실패 토스트 누적, MaterialScanModal mounted/waiting 조회·unmount는 store selectedEquip만 사용
- add_col 동적 COMMENT 작은따옴표 이스케이프 없음(마이그레이션 헬퍼)

## 변경 파일 (이번 Task 15 세션)

- `apps/frontend/src/locales/ko.json`, `en.json`, `zh.json`, `vi.json`: `comCode.CARRIER_TYPE`, `comCode.CARRIER_STATUS` 6키씩 추가
- `apps/frontend/public/help/user/ko/MST_CARRIER.md`: 신규 — 대차관리 사용자 도움말
- `apps/frontend/public/help/user/ko/PROD_CARRIER_STATUS.md`: 신규 — 대차현황 사용자 도움말
- `apps/frontend/public/help/manifest.json`: `MST_CARRIER`, `PROD_CARRIER_STATUS` 항목 추가
- `docs/reports/unfinished-work/2026-09-19-process-carrier-flow.md`: 이 기록

(Task 1~14의 변경 파일은 각 태스크 커밋 로그 및 `docs/specs/2026-09-19-process-carrier-flow-design.md` 참조. 이번 세션은 새로 수정하지 않았다.)

## 검증 상태

- 실행함: `pnpm.cmd run typecheck:backend` → 오류 0
- 실행함: `pnpm.cmd run typecheck:frontend` → 오류 0
- 실행함: `pnpm.cmd --filter @harness/backend exec jest src/modules/production/services/carrier src/modules/master/services/carrier src/modules/master/services/routing-carrier-flag src/modules/material/services/mat-issue` → 7 스위트 71건 통과
- 실행함: `node --test`(공용 carrier 모듈 + 대차관리/대차현황/키오스크·조립 prep-guide/서브조립/자재출고 carrier + 메뉴 로케일 커버리지 구조 테스트 7개 파일) → 49건 통과
- 실행함: `node scripts/find_missing_i18n.js` → 이번 대차 관련 누락(3건, `comCode.CARRIER_STATUS.*`)은 이번 세션에서 해소. 전체 누락은 348→345건(잔여 345건은 이 기능과 무관한 기존 누락 — material.disabledHelp/production.order/shipping.disabled 등)
- 실행함: `node tools/help-frontmatter-audit.mjs` → 누락 0개 파일
- 실행함(읽기전용): Oracle `JSHANES` — `SG_LABELS`/`FG_LABELS`/`MAT_LOTS`의 `CARRIER_NO IS NOT NULL` 건수 모두 0, `CARRIER_MASTERS` 등록 건수 0건(정리할 잔여 데이터 없음)
- 실행 못함: 브라우저 실화면 E2E(위 "미완료 / 남은 것" 체크리스트) — 이 세션 및 Task 1~14 전 세션 공통으로 브라우저 도구가 없어 수행 불가

## 중단 사유

- 브라우저 자동화 도구(claude-in-chrome/chrome-devtools)가 이 작업 세션들에 제공되지 않아 화면 클릭·스캔 기반 E2E를 수행할 수 없었다. 코드·타입·단위테스트·DB 실측으로 대체 검증했다.

## 다음 작업자가 바로 할 일

1. 위 "브라우저 실화면 E2E 검증" 체크리스트를 `claude-in-chrome` 또는 실제 브라우저로 순서대로 수행한다.
2. E2E 중 대차 데이터가 실제로 쌓이면, 대차현황 화면에서 잔여 상태(빈 대차로 복귀했는지)를 확인한다.
3. "후속 개선 후보" 항목은 사용자 우선순위에 따라 별도 태스크로 처리한다(현재는 동작에 영향 없는 것으로 판단해 보류).

## 주의사항

- `CARRIER_MASTERS`는 현재 실데이터 0건이다. E2E 검증 전 최소 1~2개 테스트용 대차(예: `CART`, `TRAY` 각 1건)를 등록해야 화면 동작을 눈으로 확인할 수 있다.
- 대차 삭제는 참조 검증 없이 물리 삭제되므로, E2E 검증 중 만든 테스트 대차를 지울 때는 대차현황에서 빈 대차인지 먼저 확인한다.
- 이번 세션에서 로케일 파일 4개와 `manifest.json`만 수정했고 다른 태스크의 기존 변경(스크립트/검사결과 화면 등 git status의 unrelated dirty 파일)은 건드리지 않았다.

## 최종 리뷰 후 추가 (2026-09-19, 커밋 ec9e0844 반영 후 잔여)

최종 브랜치 리뷰의 Important 4건(포장 시 FG 대차 해제, 대차현황 전표 발행 확인, 담긴 대차 삭제 차단, FG형 가공 공정 게이트 제외)과 Minor 2건(전표 실패 토스트, 라벨 접두어 대차번호 거절)은 `ec9e0844`로 수정·재리뷰 완료. 남은 후속 후보:

- `carrier.service.ts` 삭제 전 참조 카운트 SQL의 FG 가지에 `STATUS NOT IN ('PACKED','SHIPPED')` 필터 없음 — 과거 포장됐는데 CARRIER_NO가 남은 행이 있으면 EMPTY로 보이는 대차를 삭제할 수 없다(현재 DB 실측 해당 행 0건)
- `carrier-flow.service.ts` list()의 바코드 검색 서브쿼리 FG 가지도 같은 필터 없음
- `box.service.ts` closeBox의 FG PACKED 갱신은 `tenantWhere` 인자 미전달(기존 코드), 새 clearInTx는 box.company/plant 사용
- 대차현황 상세 조회 실패 시 전표 버튼이 비활성으로 남음(의도된 방어)
- 실적 저장 400 중 `대차 교체`만 슬롯을 비움(품목·지시 불일치·전표 발행 대차 400은 슬롯 유지)
- 키팅 대차 목록은 MIN(ITEM_CODE) 한 품목만 표시(상세는 전부)
- 동시 실적 저장 시 수용량 1~2건 초과 가능(라벨 행 락 없음)
- 자동투입 실패 토스트(개별+요약) 중복
