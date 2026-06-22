# LOCKS

## Active Locks

## T-MASTER-LABEL-PALLET-SOURCE 라벨디자인 팔레트 라벨 소스 추가
status: active
owner: codex
role: implementer
files:
- apps/frontend/src/app/(authenticated)/master/label/labelSources.ts
- apps/frontend/src/app/(authenticated)/master/label/master-label-design-only.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/label/master-label-bartender-designer.structure.test.mjs
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md

## T-DEFECT-REGISTER-PANEL 불량관리 수동등록 모달→우측 슬라이드 패널 전환
status: active
owner: claude
role: implementer
files:
- apps/frontend/src/app/(authenticated)/quality/defect/page.tsx
- apps/frontend/src/app/(authenticated)/quality/defect/components/DefectFormPanel.tsx
- package.json
- scripts/kill-dev.ps1
note: locales(ko/en/zh/vi)는 codex 잠금 중이라 미수정. 신규 라벨은 t(key, fallback)로 처리. package.json은 dev 좀비 정리 스크립트(kill /T 트리 종료) 추가 목적.

## T-RECEIVE-LOCATION 자재입고 스캔 모달 적재위치(자동/수동) 추가
status: active
owner: claude
role: implementer
files:
- apps/frontend/src/app/(authenticated)/material/receive/components/ReceiveScanModal.tsx
- apps/backend/src/modules/material/dto/receiving.dto.ts
- apps/backend/src/modules/material/services/receiving.service.ts
note: DB 변경 없음(MAT_STOCKS.LOCATION_CODE/ITEM_MASTERS.STORAGE_LOCATION 기존 컬럼 활용). 자동=품목마스터 storageLocation, 수동=작업자 선택/스캔. part-master는 codex 잠금이라 읽기만(필드명 확인).


## 운영 규칙

- `LOCKS.md`에는 현재 수정 중이거나 인계 판단이 필요한 `active`/`stale` 잠금만 둔다.
- 작업 완료 시 `JOURNAL.md`와 `ARCHIVE.md` 또는 `HANDOFF/<agent-name>.md`에 결과를 남긴 뒤, 해당 lock 항목은 이 파일에서 제거한다.
- 완료 이력을 `status: released`로 이 파일에 누적하지 않는다.
