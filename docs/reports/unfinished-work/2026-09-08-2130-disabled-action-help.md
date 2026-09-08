# 미완료 작업 기록: 비활성 사유 툴팁 확대

- 작성시각: 2026-09-08 21:30 KST
- 작성자: codex
- 작업 범위: 자재/품질/제품/출하/생산 비활성 액션 안내
- 현재 상태: 검증대기

## 완료한 것
- 100곳 이상 업무버튼에 표준툴팁 및 구체적 상태/다음행동 설명 구현.
- 공통Button/HelpTooltip 표준화, FE tsc 및 담당focused tests 통과.

## 미완료 / 남은 것
- 확대 화면별 실제 UI hover/focus/너비/하단배치 검증. localhost3002 페이지timeout 이후 재시도 필요.
- 커밋·push·배포는 이번 변경에 대해 수행하지 않음.
- 서브공정 키팅 등 미적용 범위는 전체보고서 참고.

## 변경 파일
- 전체결과: [업무 비활성 사유 표준 툴팁 확대](../2026-09-08-disabled-action-help.md).
- components/ui/Button.tsx, components/shared/HelpTooltip.tsx, 각 업무 호출부 및 docs/design/buttons.md.

## 검증 상태
- 실행함: FE tsc/diff check 통과, 자재16/품질출하6 관련테스트 통과. 직전 입하실적 표준 tooltip은 실제 확인.
- 실행 못함: 확대 생산화면 페이지 진입15초 timeout으로 이후 전체 렌더 QA 미완료.

## 중단 사유
- localhost3002 응답지연으로 실제 신규화면 렌더 검증 불완전. 구현/타입검사는 완료.

## 다음 작업자가 바로 할 일
1. localhost3002 현재 프로세스/로그 확인 후 페이지 응답 정상화 및 대상 화면 QA.
2. raw버튼 hover/disabled 키보드 포커스, 전폭/모달버튼 레이아웃, 하단 tooltip 확인.
3. 사용자 커밋/배포 지시 시 기존PDA/equipment등 dirty 분리, 수정/test/deploySHA 기록.

## 주의사항
- 기존 업무 허용/차단 조건 변경 안함. 테스트 업무데이터 생성 안함.
- 기존 다른 소유자 stale lock 범위 수정 안함. 보고서의 직전 실제 UI 증거를 확대 전수검증으로 오인하지 말 것.
