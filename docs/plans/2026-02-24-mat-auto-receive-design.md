# 자재 자동입고 설계문서

**날짜**: 2026-02-24
**상태**: 승인됨

## 목표

환경설정에 `MAT_AUTO_RECEIVE`(자동입고 여부) BOOLEAN 설정을 추가.
IQC 합격품 라벨 **최초 발행** 시 기본창고에 자동 입고 처리.
재발행이면 자동입고 스킵(라벨만 인쇄).
자동입고 꺼져있으면 기존 수동 일괄입고 프로세스 유지.

## 데이터 흐름

```
[라벨 발행 버튼 클릭] (receive-label 페이지)
       │
       ▼
  자동입고 설정? (SYS_CONFIGS.MAT_AUTO_RECEIVE = 'Y')
       │
   ┌───┴───┐
   │ Y     │ N
   ▼       ▼
 재발행?  기존 로직 (라벨만 인쇄)
 (MAT_RECEIVINGS에 해당 LOT 기록 존재?)
   │
   ├─ 재발행 → 라벨만 인쇄 (입고 스킵)
   │
   └─ 최초발행 → POST /material/receiving/auto
                  기본창고(isDefault='Y')로 자동 입고
                  + 라벨 인쇄
```

## 변경 범위

### 1. Backend

**SYS_CONFIGS 시드 데이터** — `MAT_AUTO_RECEIVE` 키 추가
- configGroup: `MATERIAL`
- configKey: `MAT_AUTO_RECEIVE`
- configType: `BOOLEAN`
- configValue: `N` (기본 비활성)
- label: `자재 자동입고`
- description: `IQC 합격품 라벨 최초 발행 시 기본창고에 자동 입고 처리`

**receiving.service.ts** — `autoReceive(lotIds, workerId)` 메서드 추가
1. `SysConfigService.isEnabled('MAT_AUTO_RECEIVE')` 확인
2. 각 LOT에 대해 MAT_RECEIVINGS 존재 여부 확인 (재발행 판별)
3. 기본 창고 조회: `Warehouse.isDefault = 'Y'`
4. 미입고 LOT만 `createBulkReceive()` 재활용하여 입고 처리
5. 결과 반환: `{ received: [...], skipped: [...] }`

**receiving.controller.ts** — `POST /material/receiving/auto` 엔드포인트

**material.module.ts** — `SystemModule` import 추가 (SysConfigService 주입용)

### 2. Frontend

**receive-label/page.tsx** — `handlePrint` 수정
1. 인쇄 전 `GET /system/configs/active`에서 MAT_AUTO_RECEIVE 확인
   (또는 useSysConfigStore에서 조회)
2. 활성이면 `POST /material/receiving/auto`에 선택된 LOT ID 전송
3. 응답에서 `received`/`skipped` 결과를 토스트로 표시
4. 이후 기존 인쇄 로직 실행

### 3. i18n (ko/en/zh/vi)

자동입고 관련 메시지 키 추가

## 제외 사항 (YAGNI)
- 품목별/거래처별 자동입고 설정 (전역 ON/OFF만)
- 자동입고 실패 시 재시도 큐
- 기본 로케이션 선택 (창고 단위만, 로케이션은 추후)
