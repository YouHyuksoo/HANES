# 미완료 작업 기록: 소모품 인스턴스(conUid) 전환 — UI 동작 검증 미실시

- 작성시각: 2026-09-14 17:15 KST
- 작성자: agent (Claude)
- 작업 범위: `docs/handoff/2026-09-14_consumable-instance-migration.md` 인계 §1~3
- 현재 상태: DB 마이그레이션·타입체크·스펙까지 완료. 화면 조작 검증(§3 4~7번)만 미실시

## 완료한 것

- **DB 마이그레이션 적용 완료** (JSHANES, `scripts/2026-09-14_consumable_mount_to_instance.sql`)
  - 실행 전 백업: `CONSUMABLE_STOCKS_BK260914`(6), `CONSUMABLE_MASTERS_BK260914`(41), `CONSUMABLE_MOUNT_LOGS_BK260914`(1)
  - blocks 1~8 성공. block 9 는 §5 주석뿐인 꼬리 블록이라 ORA-00900 (마이그레이션 실패 아님)
  - 결과: `CONSUMABLE_STOCKS` 6 → 206건 (ACTIVE 195 / MOUNTED 11), `LIFE_STATUS` 컬럼 추가(NORMAL 198 / WARNING 7 / REPLACE 1),
    `CONSUMABLE_MOUNT_LOGS` 1 → 9건, `COM_CODES` 에 `CON_STOCK_STATUS/PROC_WAIT` 1건 추가
  - INVALID PL/SQL 오브젝트 없음
- 실행 전 스크립트 수정 1건: `PROC_WAIT` 의 `SORT_ORDER` 가 기존 `MOUNTED`(3) 와 충돌 → 6 으로 변경
- 타입체크: 백엔드/프론트 `tsc --noEmit` 통과 (dev 서버 3002/3003 가동 중이라 `pnpm build` 대신 사용)
- 스펙 재작성: `consumable.service.spec.ts` — 삭제된 `mountToEquip` 테스트를
  `forceUnmount`/`setRepairStatus`/`completeRepair` 기준 7개로 교체. 생성자 인자도 `equipRepo` → `stockRepo` 로 정정
- 테스트: `consumable.service.spec.ts` + `kiosk-consumable.service.spec.ts` 16건 전부 통과
- API 실측(로컬 3003, 저장된 e2e 세션 토큰): 200 확인
  - `GET /consumables/stocks?limit=5000` → 206건 (수명현황조회)
  - `GET /consumables/stocks?status=MOUNTED` → 11건 (장착관리)
  - `GET /consumables/stocks?category=MOLD&search=CM-AP` → 필터 동작
  - `GET /equipment/consumables` → 200

## 미완료 / 남은 것

- **인계 §3 의 4~7번(화면 조작 검증) 미실시.** `claude-in-chrome` 확장이 이 세션에서 연결되지 않아
  브라우저 자동화가 불가능했다. API 200 까지만 확인했고 아래는 사람이 화면에서 확인해야 한다.
  - 4) 장착관리 강제해제 → `CONSUMABLE_MOUNT_LOGS` UNMOUNT 1건
  - 5) 키오스크 스캔 장착 → `STATUS='MOUNTED'` + MOUNT 로그, 교체 시 이전 롯트 UNMOUNT 로그
  - 6) 생산실적 등록 → `CURRENT_COUNT` 증가 + `LIFE_STATUS` 재판정 + USAGE 로그
  - 7) `LIFE_STATUS='REPLACE'` 전이 시 `EQUIP_MASTER.STATUS='INTERLOCK'`
- **마이그레이션 검증 4-2 가 2건 남아 있다 (의도된 결과, 결함 아님).**
  `CM-BL-S02`(EQ-STRIP-01), `CM-BL-MC1`(EQ-CUT-02) — 마스터는 MOUNTED 인데 인스턴스는 ACTIVE.
  **마이그레이션 전에 이미 그랬다**(실행 전 동일 쿼리로 baseline 확보함). 두 코드는 키오스크가 만든
  인스턴스가 이미 있어 스크립트의 `v_first` 상속 경로를 타지 않는다. 새 단일출처는 인스턴스이므로
  폐기 예정인 마스터 컬럼을 근거로 강제 장착시키지 않았다. 실제 장착 여부는 현장 확인 후 조정할 것.
- **인계 §4(미착수 중간 우선순위)는 손대지 않았다** — `product-traceability.service.ts` 금형 이력 conUid 전환,
  `ConsumableQueryDto.operStatus` 정리, `CONS_MASTER.md` 갱신
- **스크립트 §5(마스터 장착 컬럼 정리 DDL)는 주석 그대로 두었다.** 운영 안정화 후 별도 실행
- 인계 §6(발표자료 28p 재캡쳐)은 코드 작업이 아니라 제외

## 별도 보고 — 이번 범위 밖 구조 이슈

- `consumable-stock.controller.ts` `list()` 가 `getMany()` 로 전량을 읽고 분류/검색을 메모리에서 거른다.
  프론트가 보내는 `limit` 도 서버가 무시한다(`limit=10` 에 20건 응답). 지금은 206건이라 문제되지 않지만
  `feedback_no_n_plus_1` 기준의 안티패턴이다. 요청 범위 밖이라 수정하지 않았다.

## 변경 파일

- `scripts/2026-09-14_consumable_mount_to_instance.sql`: `PROC_WAIT` SORT_ORDER 3 → 6
- `apps/backend/src/modules/equipment/services/consumable.service.spec.ts`: 인스턴스 API 기준 재작성
- `.ai-coordination/LOCKS.md`: `T-CONS-INSTANCE-MIGRATION` 락 등록

## 주의 — 워킹트리 상태

인계 문서는 "코드 전부 전환 완료·커밋됨"이라고 적었지만 **실제로는 커밋되지 않았다.**
인계 §5 에 나열된 백엔드/프론트 파일이 전부 `M`/`??` 상태다(최근 커밋은 i18n·config·shipping·material 건).
사용자 지시 없이 커밋하지 않았으므로 다음 세션은 커밋 여부를 먼저 확인할 것.

## 추가 수정 — 화면 0건 (2026-09-14 17:4x)

API 는 200 이었는데 화면에 한 건도 안 나왔다. 원인은 마이그레이션이 아니라 응답 봉투 이중 래핑이었다.

- `consumable-stock.controller.ts` 의 `list()`/`detail()` 이 `return { data }` 로 한 번 더 감쌌다.
  전역 `TransformInterceptor` 가 `{ success, data }` 를 씌우므로 클라이언트의 `res.data.data` 가
  배열이 아니라 `{ data: [...] }` 객체가 됐다. 새로 쓴 `mount/page.tsx`, `life/page.tsx` 는
  `res.data?.data ?? []` 로 그대로 읽어 0건이 됐다(기존 `useStockData`, `ConLabelDetailPanel` 은
  `Array.isArray(raw) ? raw : raw?.data` 로 방어하고 있어서 티가 안 났다).
- 수정: 컨트롤러가 배열/객체를 그대로 반환하도록 봉투 제거. 프로젝트 관행(`ResponseUtil.success` 또는 raw 반환)과 일치시킴.
- 확인: `GET /consumables/stocks` → `data` 가 길이 206 배열, `GET /consumables/stocks/{conUid}` → 객체. 백엔드 tsc 통과.

```
의심: 컨트롤러가 전역 응답 인터셉터의 봉투 안에 { data } 를 한 번 더 감싸 클라이언트의 res.data.data 가 배열이 아닌 객체가 된다
프로브: grep -rn "return { data" --include=*.controller.ts apps/backend/src/modules  +  "^    return {$" 다음 줄이 "data:" 인 케이스
결과: 백엔드 컨트롤러 전체에서 이 파일(list 77행, detail 105행) 외 같은 유형 없음 → 두 곳 함께 수정
```

## 검증 상태

- 실행함: `oracle_connector.py --site JSHANES --execute-file scripts/2026-09-14_consumable_mount_to_instance.sql` → blocks 1~8 성공
- 실행함: 마이그레이션 검증 4-1(41개 마스터 전부 `인스턴스수 >= STOCK_QTY`), 4-2(2건, 위 설명 참조)
- 실행함: `pnpm.cmd --filter @harness/{backend,frontend} exec tsc --noEmit` → 오류 0
- 실행함: `jest --runTestsByPath consumable.service.spec.ts kiosk-consumable.service.spec.ts` → 16 passed
- 실행 못함: 화면 조작 검증 — `claude-in-chrome` 미연결
