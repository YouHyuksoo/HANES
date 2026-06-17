# TASKS

This file is active-work-only. Keep only `TODO`, `IN_PROGRESS`, and `BLOCKED` tasks here.

When a task reaches `DONE`:

1. Append detailed outcome and verification to `JOURNAL.md`.
2. Add one compact line to `ARCHIVE.md`.
3. Remove the task body from this file.

## Task Format

```md
## T-000 Short title
status: TODO | IN_PROGRESS | REVIEW | BLOCKED
owner: agent-name
role: implementer | reviewer | operator
scope:
- path/or/module
files:
- path/to/file
verification:
- command or manual check
review:
- reviewer or needs-review
notes:
- important context
```

## Active Tasks

## T-CONSUMABLE-LABEL-REPRINT 기존 소모품 라벨 재발행 테스트
status: REVIEW
owner: codex
role: implementer
scope:
- apps/frontend/src/app/(authenticated)/consumables/label
files:
- apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
- apps/frontend/src/app/(authenticated)/consumables/label/components/ConLabelDetailPanel.tsx
- apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/label/components/LabelDesignRenderer.tsx
- apps/print-agent/**
- tools/print-agent.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- http://localhost:3002/consumables/label 브라우저 재발행 테스트 PASS: UID C26061700029 재발행, 출력 팝업 UID/window.print 포함, 신규 /consumables/label/create 미호출, /material/label-print/log 201
- 좁은 우측 패널에서 재발행 버튼 상시 노출 Playwright 재검증 PASS: buttonBox가 420px panelBox 내부, UID 접근성 이름으로 클릭 가능
- 재발행 출력 방식 agent 전환 Playwright PASS: popup 0, agent /print 1회, jobId CON-REPRINT-C26061700029, 신규 채번 0건, print-log 201
- 재발행 전 미리보기 및 바코드 렌더 준비 대기 Playwright PASS: UID C26061700029, 미리보기 모달 ready barcode 1, pending 0, popup 0, agent /print 1회
- PDF 프린터 출력 결과 바코드 깨짐 원인 분리 및 수정 PASS: 전송 PNG before는 Tailwind class 미적용으로 barcode crop, after는 QR 전체/UID 정상
review:
- needs-review
notes:
- 기존 PENDING conUid를 새로 채번하지 않고 같은 UID로 재출력하고 print log만 추가한다.
- 420px 우측 패널의 넓은 테이블 구조에서는 재발행 버튼이 사용자에게 안 보일 수 있어 리스트형 행으로 보정 완료.
- 재발행 버튼은 브라우저 print dialog가 아니라 로컬 print-agent `/print`로 PNG를 전송한다.
- 출력 전 `미리보기`에서 같은 라벨 렌더링 결과를 확인할 수 있게 하고, 바코드 비동기 생성이 끝나기 전에는 agent PNG 캡처를 진행하지 않는다.
- 미리보기 정상/PDF 깨짐의 원인은 SVG foreignObject PNG 변환 시 Tailwind class가 적용되지 않아 absolute/object-contain 등 핵심 스타일이 빠진 것이다. `LabelDesignRenderer` 출력 필수 스타일은 inline style로 유지해야 한다.

## T-PRINT-AGENT-GO Go 기반 로컬 프린트 에이전트 추가
status: REVIEW
owner: codex
role: implementer
scope:
- apps/print-agent (Windows 로컬 프린트 에이전트)
- apps/frontend/src/services (프론트 연동용 클라이언트)
files:
- apps/print-agent/**
- apps/frontend/src/services/print-agent.ts
- tools/print-agent.structure.test.mjs
- docs/superpowers/plans/2026-06-17-hanes-print-agent.md
verification:
- node tools/print-agent.structure.test.mjs PASS
- C:\go\bin\go.exe test ./... PASS
- go build dist\hanes-print-agent.exe PASS
- tray 실행 경로 agent /health, /printers PASS
- agent 자체 `/settings` 설정관리 페이지 HTTP 200 PASS
- `/config` 기본 프린터 저장 및 config.json 반영 PASS
- `/test-print`가 저장된 기본 프린터 `Microsoft Print to PDF`로 queued PASS
- listenAddress 임시 변경 시 restartRequired=true, 복구 시 false PASS
- C:\go\bin\go.exe build -o dist\hanes-print-agent-new.exe .\cmd\hanes-print-agent PASS
review:
- needs-review
notes:
- 웹에서 사전 렌더링한 PNG를 localhost agent로 보내고, agent는 Windows 프린터 드라이버로 조용히 출력하는 1차 범위.
- Windows 트레이 상주, 상태 보기, 설정, 프린터 보기, 종료 메뉴 구현 완료. agent 자체 `/settings` 설정관리와 config 파일 저장 검증 완료. 트레이 설정 메뉴의 실제 클릭 육안 검증과 Zebra 실출력 검증은 남음.

## T-PDA-PALLET-SHIP PDA 팔레트 단위 출하 지원
status: TODO
owner: unassigned
role: implementer
scope:
- apps/backend/src/modules/shipping (출하지시-팔레트 연계 설계)
- apps/frontend/src/hooks/pda/useShippingScan.ts
files:
- apps/frontend/src/hooks/pda/useShippingScan.ts (TODO 마커 위치)
verification:
- PDA 팔레트 스캔 → 출하 → 재고 단일 차감 확인 (이중 차감 금지)
review:
- needs-review
notes:
- 결정 D-20260611-PDA-SHIPPING-BOX-ONLY 참조. 현재 PDA는 박스 단위만 지원, 팔레트 스캔은 PALLET_NOT_SUPPORTED 안내.
- 백엔드 shipBox()는 팔레트 적재 박스를 이중 차감 방지로 거부 — 우회 금지. shipment 자동 생성 또는 ship-pallet 전용 엔드포인트 설계 필요.
