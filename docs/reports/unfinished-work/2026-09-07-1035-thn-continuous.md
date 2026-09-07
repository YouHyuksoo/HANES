# 미완료 작업 기록: THN 통합테스트 개선 및 SG 지속 모드

- 작성시각: 2026-09-07 10:35 KST
- 작성자: codex-thn
- 작업 범위: 9월4일 오후 3건 + 통합테스트 10건 후속 개선
- 현재 상태: 사용자결정대기 / 배포 전 검증대기
- 코드 기준: `e2b1fa8f` + 미커밋 작업본. 수정 커밋 및 배포 SHA 없음.

## 완료한 것

| 요청 | 현재 반영 및 근거 |
| --- | --- |
| 오후01 설비 해제 | 수정 payload의 빈 equipCode 유지. 실제 서비스→Oracle에서 배정 후 공란 저장 시 NULL 확인, 롤백 복원 |
| 오후02 타설비 장착 안내 | 실제 다른 설비 장착 LOT에 설비명·해제 안내 HTTP400 확인. 전회 보고서 참조 |
| 오후03 SG 지속 | 기본 ON, 서버 잔량으로 세트 유지·소진 제거·실패 재조회. 동일 SG6종으로 실제 DB 연속2건 10→9→8 차감 및 롤백 |
| 통합01 검사 순서 | 사용자 통전→육안 확정. 실제 라우팅 MASSY10→CIINS20→OINSP30 적용. 육안 판정 및 직접 상태변경 모두 실제 통전 합격 이력 요구 |
| 통합02 중복 설비 | codex 생성 EQ-PRC-TEST-01/02 USE_YN=N 실제 적용. 기존 EQ-TEST-01/02 Y 유지. 검사이력40건 보존 |
| 통합06 포장 다열 | 1~5열 옵션. 실제 로그인 빈 박스 모달에서 전체 옵션 전환 확인. 시험 빈 박스 BX2609070001 생성 후 삭제 |
| 통합07 입고 메뉴명 | ko 제품입고(공정재고>창고재고), en/vi/zh 대응. 실제 화면 제목 확인 |
| 통합08 창고 제한 | 실제 FG 기본창고 FG_MAIN만 선택값으로 노출. 전회 실제 브라우저 확인 |
| 통합09 거래처 | 공통 훅은 이미 useYn=Y. 출하지시 등록의 includeInactive 예외 제거. 이력 조회 목적의 과거 거래처 검색은 유지 |
| 통합10 OQC | 실제 MENU_CATEGORY_ITEMS 2건 배정, 기존 MANAGER/OPERATOR 권한 확인. 실제 사이드바/화면/API 확인 |

## 미완료 / 남은 것

1. 통합03 회로라벨: 자동수신 여부와 수동 채번 규칙 답변 대기. 자유입력 규칙을 임의로 만들지 않음.
2. 통합04 육안 LOT 일괄: 작업지시 전체인지 별도 LOT25EA인지 묶음 기준 답변 대기. 일괄 판정 구현 전 정의 필요.
3. 통합05 포장 부서·장소: 실제 수행 부서/장소와 시스템 필수 제한 여부 답변 대기.
4. 현장 MAG_EQ_MASSY 및 B의 원자재 공정재고 6종 가용0. 브라우저에서 실제 생산 커밋을 동반하는 연속 조립은 미실시.
5. 포장 모달 25개 이상 실제 시리얼의 1~5열 시각 검증은 미실시. 이번 검증은 실DB 빈 박스의 옵션 전환까지.
6. 커밋·배포 및 배포본 SHA 대조는 미실시. 개발 실행본은 현재 dirty checkout이므로 개선요청 DB를 DONE으로 바꾸지 않음.
7. 기존 수리 기능의 실제 입고→수리→재검사→종결 전체 검증은 별도 잔여 범위이며 이번 개선 완료로 대체하지 않음.

## 변경 파일

- `apps/frontend/src/app/(authenticated)/production/input-assembly/`: page, SgScanPanel, AssemblyActionBar, hooks/useAssemblyScanSession.ts
- `packages/shared/src/utils/assembly-sg-rules.ts`, `utils/index.ts`: 프론트·서버 공통 BOM 수량 배분
- `apps/backend/src/modules/production/services/subprocess-kitting.service.ts`: 실제 SG 소비량/잔량 반환, 정렬 행 잠금, 중복 확정 차단
- 같은 services의 `assembly-sg-rules.spec.ts`, `subprocess-kitting-continuous.spec.ts`
- `apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts` 및 spec: 통전 선행 관문, 실제 Oracle 잠금, FAIL의 FG 계보 및 저장 전 대상 검증
- `apps/frontend/src/locales/{ko,en,vi,zh}.json`: 지속 옵션/입고 메뉴명
- `apps/backend/src/migrations/2026-09-06_magna_inspection_order.sql`
- `apps/backend/src/migrations/2026-09-07_deactivate_duplicate_continuity_equipment.sql`
- `docs/business-logics/PROD_INPUT_ASSEMBLY.md`: 현재 흐름 및 변경 영향지도
- 기타 기존 개선 파일은 2026-09-06-2130 보고서 참조. 기존 repair/SPC/재고 등 무관한 dirty 변경 보존.

## 검증 상태

- 실행함: `pnpm.cmd --filter @harness/backend exec jest --runInBand --silent continuity-inspect.service.spec.ts subprocess-kitting-continuous.spec.ts assembly-sg-rules.spec.ts subprocess-kitting.service.spec.ts equip-material.service.spec.ts` → 5 suites / 49 tests PASS.
- 실행함: backend/frontend `exec tsc --noEmit --pretty false` 각각 exit0. shared 및 프론트 구조검증은 앞선 실행 PASS.
- 실행함: 실제 로그인 브라우저 3002, SG6종 준비 전/후 조립실행 버튼, 지속 ON/OFF, 초기화, 입고 제목, 포장 빈 박스 열1~5.
- 실행함: 실제 HTTP POST `/api/v1/quality/continuity-inspect/visual-inspect/FG26090400413` → 400 통전검사 합격 후 육안검사 안내. 이후 DB ISSUED/검사값NULL, VISUAL 이력0 확인.
- 실행함: JSHANES 실제 서비스 rollback integration. Nest AppModule compile만 사용하고 init하지 않아 scheduler 시작 훅 미실행. 실제 QueryRunner/Repository를 서비스에 연결하고 API 모의응답 사용하지 않음.
- 시험 원자재는 같은 미커밋 트랜잭션에서 WipMatStockService로만 준비. 실제 운영 가용재고가 있다는 뜻이 아님. 연속2건, 중복FG 거부, SG누락 거부, 통전 전 육안 거부, 통전→육안 PASS, 잘못된 통전FAIL 거부 후 육안 재판정 PASS.
- 마지막 시험 FG26090700466/00467/00468, 실적 PR26090700280/00281. 롤백 후 SG6종 원량10/원자재 원량0 복원. 별도 connector 조회에서 FG/검사/실적/계보 잔여 모두0.
- 실제 작업지시 서비스에서 WO2609020194 설비 MAG_EQ_MASSY 배정→빈문자열 저장→NULL 확인 후 롤백, 원래 배정 복원 확인.
- DB 변경: JSHANES 40/1000. 라우팅 migration 전 OINSP20/CIINS30, 후 CIINS20/OINSP30. 관련 자재·품질조건20/30 없음 확인.
- DB 변경: 중복 설비 migration 전 codex 생성/프로토콜0/진행지시0/양수재고0/current order NULL/통신설정 NULL. 후 개발시드2대 N, 원본2대 Y, 기존 검사이력40건 유지.
- 교차리뷰: inspection_review가 잘못된 FAIL 이력 생성 경로를 지적. FG 잠금·ISSUED·작업지시 검증을 저장 전에 수행하도록 보완 후 재리뷰 추가 지적 없음.
- 실패 이력: 처음 실제 검증의 TypeORM findOne+lock은 Oracle ORA-02014. FG/SG 및 검사 공유 잠금을 raw SELECT FOR UPDATE로 수정하고 실DB 재검증 PASS. 이후 원자재0으로 정상 재고부족 차단 확인, 성공경로는 위 rollback fixture로 분리.
- 실행 못함: 현장 재고 준비 후 실제 브라우저 연속 생산 커밋, 실제 검사기/출력장치 연동, 배포 검증.

## 중단 사유

LOT 단위/라벨 규칙/포장 운영기준 미정 및 현장 원자재 미준비. 명확한 개선 범위는 반영했으며 미정 정책은 비동기 질문으로 전달했다.

## 다음 작업자가 바로 할 일

1. 사용자 답변과 현재 HEAD/dirty/DB를 재확인하고 LOT/회로라벨/포장 기준을 구체화한다.
2. 정상 자재출고로 공정재고가 준비된 환경에서 SG 지속 ON으로 브라우저 2건 연속 확정과 실제 출력·검사·포장까지 수행한다.
3. 실제 25개 시리얼 담긴 포장 모달을 열어 열1~5 배치·누락 확인을 검증한다.
4. 승인된 커밋/배포 흐름에서 수정 커밋, 테스트 근거, 배포 SHA를 모두 확보한 후 개선요청 DONE 처리한다.

## 주의사항

- 3002 프론트/3003 백엔드는 현재 작업본 dev. 다른 앱3000 건드리지 않음. Next production build 없음.
- 실제 auth/me의 admin@hanes.com 인증 및 tenant40/1000 사용. 비밀번호 추측이나 모의 로그인 없음.
- `%TEMP%/hanes-sg-live-rollback.cjs(.log)`, `hanes-order-clear-live.cjs`, `hanes-sg-live-ui.cjs`, `hanes-pack-live-columns.cjs`가 이번 시험 스크립트다.
- rollback 테스트는 업무 데이터 미잔류를 확인했지만 Oracle sequence NEXTVAL 결번은 남는다.
- OQC 메뉴2건·라우팅순서·중복설비 미사용은 의도한 영구 DB 변경이다. 시험 재고·실적은 롤백했고 시험 빈 박스는 삭제했다.
