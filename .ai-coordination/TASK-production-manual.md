# 작업 지시: HANES MES 생산관리(PRODUCTION) 메뉴 사용자 매뉴얼 생성

너는 HANES MES repo(C:\Project\HANES)에서 작업한다. 좌측 메뉴 "생산관리"(PRODUCTION 그룹)
19개 화면에 대해, 빠진 도움말을 소스 분석으로 작성해 채운 뒤, 19개 전체를 한 권의
단일 HTML 배포 매뉴얼로 묶는다.

## 0. 시작 전 필독 (협업 보드)
- AGENTS.md, .ai-coordination/{README,STATE,TASKS,LOCKS}.md 를 먼저 읽는다.
- 편집할 파일(아래 작성 대상 .md + manifest.json)을 .ai-coordination/LOCKS.md 에
  본인 agent 이름·task ID와 함께 기록한 뒤 시작한다.
- 다른 AI가 잠근 파일은 건드리지 않는다.

## 1. 도움말 작성 규칙 (필수)
- 작성 가이드 docs/standards/help-authoring-guide.md 를 그대로 따른다.
- 모범 예시(이 수준·형식 모방): apps/frontend/public/help/{user,operator}/ko/MST_PART.md
- 저장 경로: apps/frontend/public/help/{audience}/ko/{MENU_CODE}.md  (이번 범위는 ko만)
- frontmatter: 1번째 줄부터 ---, UTF-8 BOM 절대 금지, 배열은 인라인 [a, b] 형식,
  menuCode=해당 코드, audience=폴더(user/operator)와 일치, title/summary/tags/keywords.
- 본문은 추측 금지. 실제 소스에서 추출한다:
  - 프론트: apps/frontend/src/app/(authenticated)/<route>/page.tsx (+ 같은 폴더 components/*.tsx)
  - 백엔드: apps/backend/src/modules/<module>/ 의 controller/dto/entity (grep으로 탐색)
  - 화면 한글명은 page.tsx 제목 또는 apps/frontend/src/locales/ko.json 의 labelKey 값
- 사용자용 구조: # 화면명 / ## 화면 목적 / ## 화면 구성 / ## ① 컬럼(그 화면의 모든
  컬럼·필드를 표 `| 컬럼 | 역할 / 의미 |`로 빠짐없이) / ## 사용 순서 / ## 입력 규칙·검증 /
  ## 자주 묻는 질문 / ## 관련 화면
- 운영자용 구조: # 화면명 — 운영 가이드 / ## 시스템 목적·역할 / ## 데이터 구조 /
  ## ① — {TABLE_NAME}(전체 컬럼 `| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |`) /
  ## 사전 설정 / ## 운영 절차 / ## 권한 / ## 문제 해결 / ## 데이터·연계(멀티테넌시
  COMPANY/PLANT_CD 스코프 명시)
- 컬럼명은 **한글명(코드명)** 병기. "코드입니다" 수준 금지 — 역할+의미(왜)까지.

## 2. 작성 대상 (코드 → route)  ※이미 있는 화면은 작성하지 말 것

### 2-A. user + operator 둘 다 작성 (12개)
PROD_SIMULATION        /production/simulation
PROD_SPEC_SETUP        /production/specification-setup
PROD_KITTING           /production/subprocess-kitting
PROD_INPUT_ASSEMBLY    /production/input-assembly
PROD_PROGRESS          /production/progress
PROD_INPUT_INSPECT     /production/input-inspect
PROD_INPUT_EQUIP       /production/input-equip
PROD_WIP_STOCK         /production/wip-stock
PROD_FG_STOCK          /production/fg-stock
PROD_WIP_MAT_STOCK     /production/wip-material-stock
QC_REWORK_HISTORY      /quality/rework-history
PROD_REPAIR            /production/repair

### 2-B. user만 작성 (operator는 이미 존재) (3개)
PROD_RESULT            /production/result
PROD_RESULT_SUMMARY    /production/result-summary
QC_REWORK              /quality/rework

### 2-C. 이미 완비 — 손대지 말 것 (4개)
PROD_MONTHLY_PLAN, PROD_ORDER, PROD_INPUT_KIOSK, PROD_WIP_MAT_TRANS

## 3. manifest 등재
작성한 화면을 apps/frontend/public/help/manifest.json 의 categories 중 생산 관련
카테고리(key 예: "production")의 items 에 { "menuCode", "title", "path" } 로 추가한다.
title 은 각 화면 user/ko/{CODE}.md 의 frontmatter title 과 동일하게. 저장 시 BOM 금지,
2-space 들여쓰기 유지. (QC_REWORK / QC_REWORK_HISTORY 는 메뉴상 생산관리 그룹에 속하나
품질 카테고리에 두는 게 자연스러우면 그쪽에 등재해도 됨 — 판단해서 일관되게.)

## 4. 매뉴얼(단일 HTML) 생성
도움말을 다 채운 뒤, 아래 러너로 19개를 한 권으로 만든다. 프론트 dev 서버가
http://localhost:3002 에 떠 있어야 한다(없으면 사용자에게 띄워달라고 요청).

  cd C:\Project\HANES
  $env:HELP_MANUAL_CODES = 'PROD_MONTHLY_PLAN,PROD_SIMULATION,PROD_SPEC_SETUP,PROD_KITTING,PROD_INPUT_ASSEMBLY,PROD_ORDER,PROD_RESULT,PROD_PROGRESS,PROD_INPUT_KIOSK,PROD_INPUT_INSPECT,PROD_INPUT_EQUIP,PROD_RESULT_SUMMARY,PROD_WIP_STOCK,PROD_FG_STOCK,PROD_WIP_MAT_STOCK,PROD_WIP_MAT_TRANS,QC_REWORK,QC_REWORK_HISTORY,PROD_REPAIR'
  $env:MANUAL_TITLE   = 'HANES MES 생산관리 사용자 매뉴얼'
  $env:MANUAL_SYSTEM  = 'HARNESS MES'
  $env:MANUAL_VERSION = 'v1.0'
  $env:MANUAL_SLUG    = 'hanes-production-manual'
  node C:\Users\hsyou\.claude\skills\help-manual-export\scripts\help-manual-export-runner.mjs

출력: docs/manuals/hanes-production-manual-<날짜>.html (단일 파일, 이미지 base64 내장)
+ 같은 이름 .result.json. ※위 러너 경로에 접근 불가하면 사용자에게 알리고, 도움말
작성/검증까지만 완료한 뒤 매뉴얼 생성은 보류한다(임의로 다른 스크립트를 만들지 말 것).

## 5. 검증·보고
- 작성한 모든 .md: 1행이 ---, BOM 없음, audience=폴더 일치, 화면의 모든 컬럼 누락 0.
- 러너 콘솔 JSON 의 missingHelp / missingCapture 가 빈 배열인지 확인.
- 끝나면: 작성한 파일 수, manifest 추가 항목, 매뉴얼 경로, 발견한 코드/DB 불일치(있으면)
  를 보고한다.
- 작업 종료 전 .ai-coordination/LOCKS.md 잠금 해제 + JOURNAL.md 에 한 줄 기록.
