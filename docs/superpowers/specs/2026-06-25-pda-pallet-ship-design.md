# PDA 팔레트 출하 설계

- 작성일: 2026-06-25
- 상태: 설계 확정, 구현 대기

## 목표

데스크톱 팔레트적재+팔레트출하와 **동일한 업무 프로세스**를, PDA에 맞춘 UI(키보드 최소·선택/스캔 위주)로 제공하는 신규 PDA 화면을 추가한다.

## 핵심 결정

- **동일 프로세스, UI만 PDA화**: 생성 → 박스 적재 → 마감 → 출하. 비즈니스 로직/검증은 데스크톱과 동일(같은 API).
- **백엔드 변경 없음**: 모든 엔드포인트가 이미 존재. 프론트(PDA)와 메뉴 등록만 추가.
- **출하지시당 팔레트 1개** 모델(데스크톱 동일). 미출하 팔레트가 있으면 이어서 구성.
- 입력은 스캔과 버튼 선택 위주. 자유 텍스트 키보드 입력은 두지 않는다.

## 화면

신규 PDA 화면 `/pda/shipping-pallet`, 메뉴 코드 `PDA_PALLET_SHIP`. 기존 `/pda/shipping`(박스 즉시출하)와 별도이며, 기존 화면의 PLT 차단은 유지(역할 분리).

## 단계(Phase) 흐름

```
1. SCAN_ORDER     출하지시 바코드 스캔 → CONFIRMED 검증, 라인/진행률 표시
2. SCAN_WORKER    작업자 QR 스캔 (출하 귀속용, 기존 PDA 출하와 동일)
3. BUILD_PALLET   팔레트 구성
   - 지시에 미출하(OPEN/CLOSED) 팔레트가 있으면 이어서, 없으면 [새 팔레트] 버튼 → 자동채번 생성(OPEN)
   - 박스번호 스캔 → 검증(CLOSED·OQC PASS·미할당) → 즉시 팔레트에 적재(스캔=즉시 추가)
   - 적재 박스 목록·박스수·총수량 누적 표시, 박스 제거 버튼 제공
   - [팔레트 마감] 버튼 → CLOSED
4. SHIP_PALLET    [출하] 버튼 → ship-pallets 호출 → 완료·이력 기록·리셋
```

## 재사용 API (모두 기존)

- `GET  /shipping/orders/:no` — 출하지시 조회(CONFIRMED 검증)
- `GET  /master/workers/by-qr/:qr` — 작업자 QR
- `GET  /shipping/pallets?...` — 지시의 기존 팔레트 확인(미출하 팔레트 이어서)
- `POST /shipping/orders/:no/pallets {}` — 팔레트 생성(자동채번)
- `GET  /shipping/boxes?boxNo=&status=CLOSED&oqcStatus=PASS&unassigned=true` — 박스 적재 검증
- `POST /shipping/orders/:no/pallets/:palletNo/boxes { boxIds }` — 박스 적재(boxIds=박스번호)
- `DELETE /shipping/orders/:no/pallets/:palletNo/boxes { boxIds }` — 박스 제거
- `GET  /shipping/pallets/barcode/:palletNo/boxes` — 적재된 박스 조회
- `POST /shipping/orders/:no/pallets/:palletNo/close` — 마감
- `POST /shipping/orders/:no/ship-pallets { palletNos, workerId }` — 출하

## 구성요소 (기존 PDA 구조 따름)

- `app/pda/shipping-pallet/page.tsx` — phase 상태머신 렌더(기존 `/pda/shipping` 페이지 패턴)
- `hooks/pda/usePalletShipScan.ts` (+ `.types.ts`) — 단계 상태·API 호출 훅
- `app/pda/shipping-pallet/components/*` — 진행 패널 등 화면 보조 컴포넌트
- 공통 PDA 위젯 재사용: `PdaHeader`, `ScanInput`, `ScanResultCard`, `ScanHistoryList`, `PdaActionButton`, `useBarcodeDetector`, `useSoundFeedback`

## 메뉴 등록 (RBAC)

- `components/pda/pdaMenuConfig.ts` `pdaMainMenuItems`에 `PDA_PALLET_SHIP` 항목 추가(아이콘/색상 완전 클래스)
- 백엔드 `system/services/pda-role.service.ts`의 `PDA_MENU_CODES` 상수에 `PDA_PALLET_SHIP` 추가(권한 할당 가능화)

## 오류 처리

서버 검증 메시지를 그대로 표시(데스크톱과 동일 계약): 미확정 지시, 박스 미발견/이미할당/OQC 불합격, 빈 팔레트 마감, 출하수량 초과 등. PDA 에러 코드는 기존 패턴대로 `t(key, fallback)`로 다국어 처리(locale 락 시 한국어 fallback).

## i18n

`pda.palletShip.*` 네임스페이스. 기존 PDA 패턴대로 컴포넌트에서 `t(key, "한국어 fallback")` 사용. locale 4파일이 락이면 fallback만으로 동작.

## 비목표 (YAGNI)

- 출하지시당 멀티 팔레트, 팔레트 라벨 PDA 출력, 팔레트 reopen은 v1 범위 아님(데스크톱에서 처리).

## 검증

- 프론트 `tsc --noEmit` 0, 백엔드 `tsc --noEmit` 0(상수 추가분).
- 실DB E2E: 출하지시 스캔 → 팔레트 생성 → 박스 스캔 적재 → 마감 → 출하까지 1건 정상 처리, 데스크톱 화면에서 동일 결과 확인.
