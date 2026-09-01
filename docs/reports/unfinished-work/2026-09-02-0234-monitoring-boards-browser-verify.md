# 미완료 작업 기록: 모니터링 보드 4종 — 브라우저 실동작 검증 잔여

- 작성시각: 2026-09-02 02:34 KST
- 작성자: claude (background session)
- 작업 범위: 좌측 모니터링 메뉴에 보드 4종 추가 (TV 생산현황 / 품질 / 재고 / 작업지시 칸반)
- 현재 상태: 검증대기

## 완료한 것

- 백엔드 신규 `monitoring` 모듈 + 집계 API 3본 (커밋 c278cba8)
  - GET /monitoring/boards/production · quality · inventory (칸반은 production 재사용)
- 프론트 보드 화면 4종 + 공통 컴포넌트(BoardChrome/BoardStat/BoardClock/useRotation) (커밋 5dee01d5)
- 메뉴 4곳 등록(menuConfig/menu-config.json/validator) + i18n ko/en/zh/vi (커밋 f3a4757f)
- DB MENU_CATEGORY_ITEMS MERGE 적용(JSHANES, COMPANY=40/PLANT_CD=1000) — post 조회로 5건 확인
- backend/frontend tsc 통과, locale JSON 파싱 검증 통과
- 라우트 살아있음 확인: GET http://localhost:3003/api/v1/monitoring/boards/production → 401(JWT 가드 정상, 404 아님)
- 구현 계획: docs/plans/2026-09-02-monitoring-boards.md (커밋 f44dd8af)

## 미완료 / 남은 것

- 로그인 세션으로 4개 보드 화면 실제 렌더 확인 (KPI/테이블/차트/칸반, 자동 페이지 순환, TV 전체화면 모드)
- 실데이터 기준 집계값 타당성 확인 (특히 재고 보드 금일 입출고 TRANS_TYPE 접미사 분류: `%_IN` / `%_OUT` + PROD_CONSUME)

## 변경 파일

- apps/backend/src/modules/monitoring/**: 신규 모듈(컨트롤러 1, 서비스 3)
- apps/backend/src/app.module.ts: MonitoringModule 등록
- apps/frontend/src/app/(authenticated)/monitoring/{production-board,quality-board,inventory-board,job-order-board}/**: 보드 화면 4종
- apps/frontend/src/components/monitoring/{BoardChrome,BoardStat,BoardClock,useRotation}.tsx: 보드 공통
- apps/frontend/src/components/monitoring/MonitoringSettingsModal.tsx: showTargets 옵션 추가
- apps/frontend/src/config/menuConfig.ts, apps/backend/src/seeds/menu-config.json, apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts: 메뉴 코드 등록
- apps/frontend/src/locales/{ko,en,zh,vi}.json: menu.monitoring.* + monitoring.board.*

## 검증 상태

- 실행함: backend/frontend tsc 통과, locale JSON node 파싱 OK, DB MERGE post 조회 5건, API 401 응답(라우트 존재)
- 실행 못함: claude-in-chrome 브라우저 검증 — 확장 미연결(브라우저 세션 없음)

## 중단 사유

- 브라우저 확장 미연결 환경 (백그라운드 세션)

## 다음 작업자가 바로 할 일

1. dev 서버(3002) 로그인 후 좌측 모니터링 메뉴에 보드 4종 노출 확인
2. /monitoring/production-board 데이터 렌더 + TV 모드 + 자동 순환 확인, 나머지 3개 보드 동일 확인
3. 이상 없으면 이 기록 삭제

## 주의사항

- DB MENU_CATEGORY_ITEMS에 MON_PROD_BOARD/MON_QUALITY_BOARD/MON_INV_BOARD/MON_JOB_BOARD 4행이 이미 들어가 있음(중복 실행해도 MERGE라 안전)
- push는 하지 않았음(배포 트리거 방지)
