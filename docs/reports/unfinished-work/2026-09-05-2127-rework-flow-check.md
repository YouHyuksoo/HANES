# 미완료 작업 기록: 재작업 시작부터 종결까지 검증

- 작성시각: 2026-09-05 21:27 KST
- 작성자: codex-rework
- 작업 범위: /quality/rework 읽기 전용 프로세스 점검
- 현재 상태: 검증대기

## 완료한 것

- 현재 HEAD e2b1fa8f 및 working tree 기준으로 화면 → Controller → Service → Entity 추적.
- 정상 상태: REGISTERED → QC_PENDING → PROD_PENDING → APPROVED → IN_PROGRESS → INSPECT_PENDING → PASS/FAIL/SCRAP.
- JSHANES(SERVICE_NAME=JSHNSMES), COMPANY=40/PLANT_CD=1000 조회: REWORK_ORDERS 0건. PRODUCT_STOCKS에는 FG_WIP/DEFECT 5개, SFG_WIP/DEFECT 8개, DEFECT 창고 행 없음.
- 실제 인증 브라우저에서 새로고침: 재작업 목록 API 200, 0건. 같은 인증으로 GET /api/quality/reworks/inspects는 404 '재작업 지시를 찾을 수 없습니다.' 재현.

## 미완료 / 남은 것

- 실제 생성·승인·실적·재검사·재고 반영 E2E는 실행하지 않음. 기존 지시가 없고 이번 요청은 점검이므로 업무 데이터 생성/변경하지 않음.
- 확인된 코드 결함의 수정은 수행하지 않음:
  1. rework.controller.ts: Get(':id')가 Get('inspects')보다 앞서 검사목록 요청을 단건조회로 처리(실제 404 재현).
  2. rework-process.service.ts startProcess는 공정 WAITING만 검사하고 지시 승인/선행공정 완료는 검사하지 않음. 화면도 공정 WAITING만으로 시작/건너뛰기 버튼 표시.
  3. rework.service.ts complete는 미완료 공정을 차단하지 않음. 완료 공정 resultQty 합계로 지시수량 산정(10개가 3공정이면 30개). 공정 자동완료도 같은 합산.
  4. 화면 handleProcessComplete는 실적이 0이면 planQty를 제출. 서버는 실적 원장 대조 없이 덮어씀. createResult는 공정/지시 상태 검증 없음.
  5. createInspect는 합격+불합격 수량과 완료수량의 일치, PASS/FAIL/SCRAP 판정과 수량 정합성 검증 없음. 상태/검사 저장 후 재고 이동하며 전체 단일 트랜잭션 아님.
  6. createInspect는 DEFECT 창고에서 qualityStatus 미지정(기본 GOOD)으로 이동. 현재 불량은 WIP/DEFECT에 존재. 합격 부족분 신규 입고 보충으로 기존 불량이 남은 채 양품 증가하는 코드 경로. 폐기 부족분 이동량 검증도 없음.
  7. FAIL 이후 같은 지시 재시작/재검사/재승인 전이 없음. 연결 불량이력은 REWORK로 남음.
  8. ReworkFormPanel은 defectLogId/prdUid를 제출하지 않음. 수정 시 기존 선택 공정 대신 품목 전체 라우팅 선택; 서버 update는 processItems를 버리고 지시만 갱신.

## 변경 파일

- 이 미완료 기록과 coordination 점검 기록만 작성. 업무 소스 수정 없음.

## 검증 상태

- 실행함: oracle-db connector SELECT, 실제 3002 브라우저 목록 새로고침/검사목록 GET, backend Jest rework.service.spec.ts/rework-process.service.spec.ts/rework.policy.spec.ts 3 suites 24/24 통과.
- 실행 못함: 데이터 변경을 수반하는 종단 업무 흐름. 테스트 통과는 위 결함 부재의 근거가 아님.
- 최초 화면 진입에서 /system/configs/active 500 EHOSTUNREACH 10.1.10.35:1527 관측. 이후 재작업 목록 API는 200, connector 조회 성공. 환경/포트 변경 없음.

## 중단 사유

- 읽기 전용 점검 완료. 실제 저장 E2E와 결함 수정은 남음.

## 다음 작업자가 바로 할 일

1. 현재 파일/DB 상태 재확인 후 원불량 연결, 승인 차단, 완료수량 기준, 불합격 재처리 기준 확정.
2. 현재 WIP/DEFECT 재고의 품질 전환과 원장 기록을 단일 트랜잭션으로 연결하고 부족분 자동 생성 제거.
3. 검사목록 라우트 순서 수정 및 위 결함 회귀 테스트, 승인된 테스트 데이터로 생성부터 종결까지 검증.

## 주의사항

- 기존 타 작업 dirty 변경 보존. 테스트 데이터 생성/수정/삭제 없음.
- 실제 중복입고가 이미 발생했다고 판단한 것은 아님: 현재 재작업지시 0건, 재고 불일치는 현재 코드 경로와 실제 불량재고 위치의 대조 결과.
