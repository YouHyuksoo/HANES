# 미완료 작업 기록: THN 실제 연결 후 개선 반영

- 작성시각: 2026-09-06 21:40 KST
- 작성자: codex-thn
- 작업 범위: 앞선 13건 검토의 실제 연결 재검증 및 확정 개선
- 현재 상태: 일부 적용 / 검증대기 / 업무 기준 결정대기
- 선행 기록: 2026-09-06-2038-thn-integration-review.md
- 소스 기준: e2b1fa8f + 현재 working tree. 배포 SHA 확인 아님.

## 완료한 것

1. JSHANES 연결 복구 확인(SELECT 1 FROM DUAL 성공).
2. 3002/3003 리스너가 없어 현재 checkout의 기본 개발 서버 실행. 기존 프로세스 종료/대체 포트/production build 없음.
3. OQC 미노출 원인 확정 및 실제 수정:
   - COMPANY=40, PLANT_CD=1000: QC_OQC/QC_OQC_HISTORY 메뉴 배정 0건.
   - QUALITY는 활성 Y. MANAGER/OPERATOR의 두 메뉴 권한 총 4건은 이미 Y.
   - migration으로 QUALITY 정렬 120/130에 배정 2건 INSERT. 권한 변경 없음.
   - 사후 DB: 메뉴 배정 2건, 활성 Y, 메뉴별 허용 역할 2개.
   - 실제 브라우저 품질관리 펼치기 → 출하검사(OQC), 출하검사이력조회 표시 확인. OQC 페이지와 GET /quality/oqc 조회 성공.
4. 제품입고 창고: 실제 FG 기본창고 FG_MAIN(완제품 메인창고) 확인. 화면은 서버와 동일 기본창고만 표시하고 선택 변경을 막음. 브라우저 select 값 FG_MAIN, 비어 있지 않은 option 1개 확인.
5. 출하지시 등록: 미사용 포함 옵션 제거, 기본 useYn=Y 적용. 실제 등록 폼 열림 및 고객사 활성 필터 API 200/1건 확인. 저장은 하지 않음.
6. 포장 목록: PackedSerialList 컴포넌트로 분리하고 1~5열 선택 추가. 일련번호/전체 시리얼 표시/삭제 요청 연결 보존. 현재 실제 박스는 마감 상태여서 다열 모달 조작은 미검증.
7. 앞선 자재 장착 안내를 실제 API/DB로 확인:
   - VH1-RM260705-00006은 EQ-ATCNS-02에 4개 장착, 해당 공정 대기재고 없음.
   - EQ-ATCNS-01 장착 요청은 HTTP 400, "다른 설비(자동절단탈피 설비 #2 (EQ-ATCNS-02))에 장착중입니다. 해제 후 장착하세요." 반환.
   - 사후 DB: EQ-ATCNS-01 0개, EQ-ATCNS-02 4개 유지. 정상 재고 이동을 발생시키지 않은 거부 시나리오.

## 추가 실제 DB 사실

- EQ-PRC-TEST-01/02: CREATED_BY=codex, CREATED_AT=2026-06-11 20:28:57, USE_YN=Y.
- EQ-TEST-01/02: CREATED_BY=SYSTEM, 2026-03-05 생성, USE_YN=Y. 네 설비 모두 PRC-TEST.
- EQ-PRC-TEST-01 검사 이력 40건 존재. 두 코드의 생산실적/작업지시/양수 설비재고 조회에서는 행이 없음. 프로토콜·기준정보 연결 및 현장 사용 여부까지 확인 전 미사용 전환 안 함.
- MAG_EAD65942601 작업지시 라우팅: RT_MAG_EAD65942601, 10 MASSY 조립 → 20 OINSP 육안검사 → 30 CIINS 회로검사.
- 해당 품목 FG 라벨 45건. PACKED/SHIPPED 중 INSPECT_PASS_YN이 Y가 아닌 건은 0건. 이것만으로 모든 검사 경로의 누락 방어를 증명하지는 않는다.
- FG_MAIN만 기본 FG 창고 Y. WH-FG/FG_SHIP은 활성이나 기본 N, KS_WH_SHIP은 미사용 N.

## 미완료 / 남은 것

- SG 지속 모드: Hermes stale lock 인계 응답 대기. 연결 복구 발언을 파일 잠금 인계 승인으로 해석하지 않음.
- 제품입고 메뉴명 변경: locale 타 세션 stale lock 보존, 미수정.
- 검사 순서/LOT 육안검사/회로라벨 규약/포장 책임·장소는 업무 기준 확인 필요.
- 중복 설비 사용 연결 추가 확인 및 보존 세트 결정 후 미사용 처리.
- 설비 해제 실제 저장→DB null 확인, 포장 다열 조작, 실제 입고·출하지시 저장은 이번에 수행하지 않음.
- 원격 배포 SHA 및 배포본 차이, 수리 기능 실제 전체 종단 검증은 미완료.
- 현장 개선요청 DONE 전환 없음.

## 변경 파일 / 영향

- apps/backend/src/migrations/2026-09-06_oqc_menu_assignment.sql: JSHANES 메뉴 배정 2건, 중복 실행 시 기존 배정 보존.
- apps/frontend/src/app/(authenticated)/product/receive/components/ReceivablePanel.tsx: 기본창고 표시. useWarehouseOptions.defaultCode 및 서버 receiveFg의 기본창고 정책에 의존.
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx: 신규 등록 거래처 옵션의 useYn 필터.
- apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx: PackedSerialList 연결.
- apps/frontend/src/app/(authenticated)/shipping/pack/components/PackedSerialList.tsx: 표시 열수/목록 렌더 담당. 데이터 저장·삭제 로직은 기존 부모에 유지.

## 검증 상태

- frontend tsc --noEmit --pretty false 통과, git diff --check 통과.
- 실제 인증 /auth/me HTTP 200. 테스트용 가짜 API 응답/route interception 없음.
- 실제 브라우저 /quality/oqc, /product/receive, /shipping/pack, /shipping/order 진입 및 페이지 오류 0건.
- 추가 검증에서 OQC 사이드바 버튼 노출, 입고창고 option, 출하지시 등록 폼 확인.
- 첫 브라우저 검증 스크립트는 메뉴를 link로 찾고 버튼 이름을 잘못 지정해 실패. 현재 SidebarMenu 실제 button 구조에 맞춰 locator를 고친 재실행 통과. 앱 오류로 분류하지 않음.
- Oracle connector --site JSHANES --execute-file apps/backend/src/migrations/2026-09-06_oqc_menu_assignment.sql: 2 blocks 성공 및 사후 조회 확인.

## 중단 사유

- 파일 잠금 인계 및 현장 업무 기준 미확정. 실환경 접속 장애는 해소됨.
- 포장 다열 검증만을 위해 마감 박스를 재오픈하지 않음.

## 다음 작업자가 바로 할 일

1. 승인된 파일 범위 인계 후 SG 지속모드/메뉴명 처리.
2. 현장 검사 순서·LOT 판정 규칙과 회로라벨 규격 확정.
3. 정상 업무 데이터 또는 승인된 시험 데이터로 저장·재고 이동 및 포장 모달 검증.
4. 검사기 프로토콜/기준정보 참조 확인 후 중복 설비 미사용 처리.
5. 배포본 SHA 확인 및 승인된 배포 후 현장 확인.

## 주의사항

- DB 변경은 OQC 메뉴 배정 2건만 있음. 시험 생산/재고 데이터 생성 없음.
- 실행한 로컬 개발 서버 세션: backend 11956, frontend 69693. 다른 서비스는 종료하지 않음.
- 서버 로그는 TEMP/hanes-thn-backend-dev.log 및 hanes-thn-frontend-dev.log. 브라우저 검사 스크립트는 TEMP/hanes-thn-live*.cjs.
- 수리 및 다른 세션의 dirty 변경 보존. 커밋/배포 없음.
