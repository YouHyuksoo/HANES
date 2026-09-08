# 미완료 작업 기록: 입하실적 재발행 안내 및 상태 순서

- 작성시각: 2026-09-08 21:09 KST
- 작성자: codex
- 작업 범위: 입하실적조회
- 현재 상태: 검증대기

## 완료한 것
- 재발행 비활성 원인을 로딩/시리얼없음/선택필요/입고완료/취소로 구분해 공통 Button.disabledReason 툴팁과 인라인 안내에 연결.
- 개별 선택 불가 체크박스 셀에도 사유 title 추가. 기존 서버 재발행 허용 조건 유지.
- 왼쪽 그리드 상태를 맨 앞으로 이동(상태→입하취소→입하번호).

## 미완료 / 남은 것
- 실제 브라우저 렌더 확인 및 커밋/배포.

## 변경 파일
- apps/frontend/src/app/(authenticated)/material/arrival-result/page.tsx
- apps/frontend/src/app/(authenticated)/material/arrival-result/reprintHint.ts
- apps/frontend/src/app/(authenticated)/material/arrival-result/arrivalResultColumns.tsx
- apps/frontend/src/locales/ko.json

## 검증 상태
- 실행함: frontend tsc --noEmit --pretty false 및 git diff --check 통과.
- 실행 못함: 실제 브라우저 확인은 이번 변경에서 수행하지 않음.

## 중단 사유
- 구현 및 타입검사 완료. 실제 화면과 배포 반영까지 확인한 상태는 아님.

## 다음 작업자가 바로 할 일
1. localhost3002에서 새로고침 후 상태 첫 컬럼 및 재발행 disabled 사유 확인.
2. 커밋/배포 요청 시 위 범위만 포함.

## 주의사항
- DataGrid가 열린 화면의 컬럼순서를 메모리에 유지하므로 상태 순서 확인은 새로고침 후 진행.
- 타작업 dirty 보존. 재발행 제한 자체는 변경하지 않음.
