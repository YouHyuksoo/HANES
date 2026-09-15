# 미완료 작업 기록: 관리계획 문서시스템 실제 UI 검증

- 작성시각: 2026-09-15 13:00 KST
- 작성자: codex
- 작업 범위: 품질관리 > 관리계획서의 생성, 개정, 수정, 발행, 출력, 이력관리
- 현재 상태: 완료

## 완료한 것

- PFD, PFMEA, Control Plan 패키지/Revision/검증/발행 API와 편집 화면을 구현했다.
- JSHANES 서버 DB에 9개 테이블, 12개 시퀀스, 16개 공통코드를 적용하고 사후 점검했다.
- PFD 응답 정규화, 전체 Revision 이력, 두 Revision 비교, 출력 감사이력, 발행 전 기본정보 수정, 빈 문서 발행 차단을 추가했다.
- 원본 QREKA-PR-025의 13~16쪽을 대조해 A4/A3 공식 PDF 4종과 Excel 출력 양식을 구현했다.
- Excel 워크시트 XML에 PFD A4 가로, PFMEA/Control Plan A3 가로, 개정이력 A4 세로 설정과 인쇄영역을 기록하고 실제 생성 파일에서 판독 검증했다.
- 구 조회 API는 신규 Revision 어댑터를 유지하고, 구 쓰기 API는 레거시/신규 이중 원장을 막기 위해 `410 Gone`으로 종료했다.
- backend focused 11 suite 101 test와 구 API focused 12 test, shared/frontend 12 test, shared/frontend/backend typecheck를 통과했다.

## 완료된 후속 검증

- 기능 worktree의 프론트 3002, 백엔드 3003 dev 서버를 재실행하고 backend health와 JSHANES 연결을 확인했다.
- 실제 로그인 Playwright에서 묶음 생성, 빈 문서 발행 차단, 자동 PFD, PFMEA/Control Plan 행 추가, 3종 발행, REV.01 개정, 이력, PDF 4종, Excel 다운로드까지 통과했다.
- 승인 아트팩트 `control-plan-final-preview-v2`를 기준으로 실제 데이터 A3 관리계획서 미리보기를 출력센터에 적용했다.
- 미리보기는 320px 고정 높이와 항상 표시되는 양축 스크롤을 적용했고, 브라우저에서 744×320 viewport가 1500×1061 문서를 양축 끝까지 이동함을 확인했다.
- PFD, PFMEA, 개정이력, Control Plan 미리보기를 PDF iframe과 분리된 HTML 문서로 통일하고, `크게 보기`에서 동일 문서를 72vh 모달로 확대하도록 했다.
- 빠른 품목검색 응답이 초기 전체조회에 덮이는 경쟁 상태와 중첩 모달 제목 ID 충돌을 수정했다.
- Oracle array bind 중복 두 곳과 DRAFT 전용 unique index 표현식 오류를 수정하고 JSHANES에 교정 migration을 적용했다.

## 변경 파일

- `apps/backend/src/modules/quality/control-plan/`: 신규 문서시스템 API와 서비스.
- `apps/backend/src/migrations/2026-09-15_*.sql`: JSHANES 적용 migration.
- `apps/frontend/src/app/(authenticated)/quality/control-plan/`: 통합 문서관리 화면과 출력 기능.
- `docs/database/schema-erd.md`: JSHANES 기준 ERD 재생성.

## 검증 상태

- 실행함: backend focused test, 구 API adapter/write guard test, shared rule test, frontend structure test, shared/frontend/backend typecheck, help audit, PDF 단일·다중 페이지 8개 크기·페이지·양식번호, Excel 4개 시트 용지·방향·인쇄영역·병합, JSHANES post-check.
- JSHANES post-check: 테이블 9, Sequence 12, 고아 Revision 0, 고아 Control Plan→PFD/PFMEA 참조 0, 문서별 중복 DRAFT 0.
- 최종 증빙 패키지 12: PFD REV.00 PUBLISHED 6행, PFMEA REV.00 PUBLISHED 1행, Control Plan REV.00 PUBLISHED 1행, REV.01 DRAFT 1행.
- Playwright: setup 포함 2 passed (45.0s). 기본 미리보기 → PFD 전환, 확대 모달, 새 탭 미생성, 양축 스크롤, PDF 4종과 Excel 다운로드를 포함한다.
- 출력 실파일: 단일 PDF 4종과 다중 PDF 4종의 페이지 수/MediaBox/form 0 확인, Excel 4개 Sheet의 용지·방향·인쇄영역·병합 확인.

## 잔여 작업

- 기능 구현과 검증 기준의 잔여 작업은 없다.
- 커밋/푸시는 사용자 요청이 있을 때 별도 수행한다.

## 2026-09-15 독립 리뷰 후 보강

- 발행 PFMEA/Control Plan이 DRAFT 상위 Revision을 참조하지 못하도록 서버 발행 검증을 강화했다.
- REV.01 이후 참조 PFD/PFMEA Revision 변경 API와 행 재연결 검증을 추가했다.
- 참조 변경 시 편집기를 초기화하고 구 Revision 행 ID 저장을 UI와 서버 양쪽에서 차단했다.
- REV.01 이상 개정 사유·변경 내용 필수 검증, 출력 감사이력 조회/UI, 실패 시 생성 모달 유지와 서버 오류 메시지 표시를 추가했다.
- legacy PLAN_NO 하나에 여러 Revision이 있어도 문서 계보를 한 번만 만들고 모든 Revision을 이관하도록 SQL을 수정해 JSHANES에서 재실행했다.
- Excel도 PFD 10열, PFMEA 23열, Control Plan 18열의 원문 그룹 헤더와 병합 구조를 사용하도록 변경했다.
- 낮은 화면에서도 편집폼 아래 문서표까지 세로 스크롤되도록 작업공간과 표 최소 높이를 보강했다.
- 최종 검증: backend 11 suite/109 test, node 23 test, shared/frontend/backend typecheck, 도움말 audit, Playwright 전체 흐름 1 passed(3.1분).
- JSHANES 발행본 기준 mutable 상위 참조 0, PFMEA/Control Plan 행 계보 불일치 0, 고아 Revision 0, 중복 DRAFT 0을 확인했다.
- 재생성 출력 실파일: 단일 PDF 4종과 다중 PDF 4종의 용지·페이지 수 정상, Excel 4 Sheet의 방향·인쇄영역·그룹 병합 정상.

## 주의사항

- 임의 대체 포트를 사용하지 않는다.
- 브라우저는 DB에 직접 접속하지 않고 backend API를 통해 JSHANES(`10.1.10.35:1527/JSHNSMES`)에 접속한다.
- 사용자가 빌드를 지시하지 않았으므로 dev 서버가 있는 동안 production build를 실행하지 않는다.

## 2026-09-15 19:48 최종 완료 증거

- PFMEA 공식 23개 물리열과 CFT 참여자 입력·삭제·Revision 복제·PDF/Excel 출력을 완성했다.
- Oracle DATE를 `formatDateOnly`로 복원해 개정 시 목표일·완료일이 하루 앞당겨지는 문제를 수정했다.
- Playwright 전체 흐름 1건 통과(3.6분), backend 12 suite/115 test, 구조·공유 규칙 25 test, shared/frontend/backend typecheck를 통과했다.
- JSHANES 최신 패키지 32에서 PFMEA REV.00/01의 목표일 `2026-10-01`, 완료일 `2026-10-02`, Action RPN 42, CFT 각 1명을 확인했다.
- 패키지 32의 Control Plan→참조 PFMEA Revision 행 불일치 0건, 출력 이벤트 문서/Revision 누락 0건을 확인했다.
- PDF 8개를 재생성해 A3/A4 MediaBox와 단일·다중 페이지를 확인했고, Excel 4개 시트의 CFT·용지·방향·인쇄영역·병합을 확인했다.
- 독립 소스 리뷰 최종 판정은 `READY`다. 커밋·푸시·배포는 수행하지 않았다.
