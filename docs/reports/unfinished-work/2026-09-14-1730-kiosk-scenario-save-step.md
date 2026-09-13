# 미완료 작업 기록: 키오스크 시나리오 마지막 저장 단계 미검증

- 작성시각: 2026-09-14 17:30 KST
- 작성자: agent (Claude)
- 작업 범위: `kiosk-prod-result` 시나리오 (생산실적 키오스크, `/production/input-kiosk`)
- 현재 상태: 차단 — 점검 판정은 사람이 해야 하는 일이라 자동 검증 불가

## 완료한 것

- 시나리오 `apps/backend/src/modules/ai-scenarios/definitions/kiosk-prod-result.json` 작성 (16단계), 규격 검증 통과
- 화면 조작 진입점 12곳에 `kiosk-*` testid 부여 (이 화면에는 testid 가 하나도 없었다)
- **0~14단계(준비 전체) 실측 통과** — EQ-ATCNS-HV-01 / WO2609110377 / N91H00_WK01 / 작업수 10
  - 설비 선택 → 작업지시 검색·선택·확정 → 작업자 선택·확정 → 자재 확인 완료 → 소모품 확인 완료 → 작업수 입력
- 15단계(저장)에서 의도한 게이트에 막히는 것까지 확인. 실패 스냅샷이 사유를 통째로 담았다:
  `title: "실적입력이 불가합니다\n• 작업자설비점검 종합판정 NG (재점검 필요)"`
- `POST /ai/scenario-diagnose` 가 그 스냅샷만으로 원인·근거·해결을 정확히 짚는 것 확인

## 미완료 / 남은 것

- **15단계 저장이 한 번도 실행되지 않았다.** 그 스텝의 `expect`(POST `/production/prod-results` 201)는 미검증이다.
- 막는 조건: WO2609110377 의 작업자설비점검이 09-12 FAIL 이다. 이 점검은 육안 판정이라
  시나리오가 대신 하지 않는다(규격서 7.1). 사람이 키오스크에서 한 번 수행해야 한다.

## 변경 파일

- `apps/backend/src/modules/ai-scenarios/definitions/kiosk-prod-result.json`: 신규 시나리오
- `apps/frontend/e2e/verify-kiosk-scenario.spec.ts`: 검증 스펙 (`RUN_WRITE=1` 일 때만 저장까지)
- `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/*`: testid 부여
- `apps/frontend/src/components/production/JobOrderSelectModal.tsx`, `components/worker/WorkerSelectModal.tsx`: testid 부여
- `apps/frontend/src/scenario-driver/dom.ts`: 실패 스냅샷에 `title` 속성 포함

커밋: `5ec98713`

## 검증 상태

- 실행함: `RUN_WRITE=1 KIOSK_EQUIP=EQ-ATCNS-HV-01 KIOSK_ORDER=WO2609110377 KIOSK_QTY=10 npx playwright test e2e/verify-kiosk-scenario.spec.ts --project=chromium --no-deps`
  → 0~14 PASS, 15 FAIL(저장 버튼 비활성). PROD_RESULTS 변화 없음.
- 실행함: 시나리오 규격 검증 13건, 키오스크 구조 테스트 7종 통과
- 실행 못함: 저장 성공 경로 — 작업자설비점검 NG 로 버튼이 잠겨 있다

## 중단 사유

- 점검 판정을 에이전트가 대신 입력하면 점검 기록이 거짓이 된다. 사용자 결정/사람 수행이 필요하다.

## 다음 작업자가 바로 할 일

1. 키오스크에서 EQ-ATCNS-HV-01 / WO2609110377 의 **작업자설비검사를 실제로 수행**한다(전항목 OK 여야 인터락이 풀린다).
2. 위 Playwright 명령을 `RUN_WRITE=1` 로 다시 돌려 15단계까지 `done` 을 확인한다.
3. 확인 후 PROD_RESULTS 건수와 JOB_ORDERS.GOOD_QTY 증가를 DB 로 대조한다
   (실행 전 기준: PROD_RESULTS 1건, GOOD_QTY 100).

## 주의사항

- **EQ-ATCNS-HV-01 의 설비 상태를 INTERLOCK → NORMAL 로 바꿔 두었다**(2026-09-14, 사용자 승인).
  09-12 일일점검 FAIL 로 자동으로 잠겼던 것이고, 실제 설비를 점검해서 푼 것이 아니다.
  `UPDATED_BY = 'scenario-verify'` 로 남아 있다. 운영상 되돌려야 하면 STATUS 를 INTERLOCK 으로 되돌린다.
- 참고: `equip-inspect.service.ts` 는 FAIL 일 때 INTERLOCK 을 걸기만 하고 PASS 일 때 NORMAL 로
  되돌리지 않는다. 점검을 다시 통과해도 설비 상태는 자동으로 풀리지 않는다.
- 반제품(SEMI_PRODUCT) 공정재고가 전 공정 0건이라, ATCNS-HV 외의 공정은 자재 확인 단계를
  통과할 수 없다. 이 시나리오를 다른 설비로 돌리려면 상위 공정 실적부터 쌓아야 한다.
