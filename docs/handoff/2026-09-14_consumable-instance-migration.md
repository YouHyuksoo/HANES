# Handoff — 소모품 장착관리 인스턴스 전환 (2026-09-14)

> 이 문서는 Cowork 세션에서 작성했습니다. Cowork는 Anthropic 클라우드에서 돌아 사내망(10.1.10.35:1527)에
> 닿지 못하고, 오빠 PC 셸도 9월 8일 Windows 업데이트 이후 마운트가 깨져 명령 실행이 불가능합니다.
> 따라서 **아래 1~3번은 오빠 PC의 Claude Code 또는 직접 실행**이 필요합니다.
> Claude Code에게 이 파일을 그대로 읽히면 이어서 작업할 수 있습니다.

---

## 0. 지금 상태 한 줄

코드는 마스터 단위 → 실물 인스턴스(conUid) 단위로 **전부 전환 완료·커밋됨**.
DB 마이그레이션이 **아직 실행 안 됨** → 소모품 관련 화면 3종이 500 에러.

---

## 1. [최우선] DB 마이그레이션 실행

`CONSUMABLE_STOCKS.LIFE_STATUS` 컬럼이 없어서 아래 3개 화면이 `DB_QUERY_ERROR` 500을 냅니다.

- 소모품 수명현황조회
- 소모품 재고현황
- 소모품 장착관리

### 실행 방법 (셋 중 하나)

**(a) oracle-db 스킬 — Claude Code에서**

```
python scripts/oracle_connector.py --site <HANES사이트> \
  --execute-file C:\Project\HANES\scripts\2026-09-14_consumable_mount_to_instance.sql
```

주의: 이 파일은 `/` 구분자로 나뉜 **멀티 스테이트먼트 + PL/SQL 블록**입니다.
`--execute-file`이 `/` 분리 실행을 지원하지 않으면 `deploy_package.py` 쪽을 쓰거나 (b)로 가세요.

**(b) SQL Developer / DBeaver**

파일 열고 **스크립트 실행(F5)**. 개별 실행(Ctrl+Enter) 아니고 스크립트 실행이어야 PL/SQL 블록이 돕니다.

**(c) sqlplus**

```
sqlplus test/<비번>@10.1.10.35:1527/JSHNSMES @C:\Project\HANES\scripts\2026-09-14_consumable_mount_to_instance.sql
```

### 스크립트가 하는 일

| 단계 | 내용 |
|---|---|
| 1 | `CONSUMABLE_STOCKS`에 `LIFE_STATUS VARCHAR2(20) DEFAULT 'NORMAL'` 추가 (존재 검사 후 ALTER) |
| 2 | `COM_CODES`에 `CON_STOCK_STATUS` / `PROC_WAIT`(공정대기) 누락분 MERGE |
| 3 | 마스터 `STOCK_QTY`만큼 `PKG_SEQ_GENERATOR.GET_NO('CON_UID')` 채번해 인스턴스 생성. 장착중 마스터는 첫 인스턴스가 장착설비·누적타수·수명상태를 상속. 장착 이관분 MOUNT 이력 1건 삽입 |
| 4 | 검증 쿼리 2건 (마스터 vs 인스턴스 건수 / 이관 누락 점검 — 4-2는 **0건이어야 정상**) |
| 5 | (주석 처리) 마스터 장착 컬럼 정리 DDL — 운영 안정화 후 별도 실행 |

### ⚠ 실행 전 반드시

- `CONSUMABLE_MASTERS`, `CONSUMABLE_STOCKS` 백업
- **데이터 근사치 주의**: 마스터의 누적 타수는 "코드 단위 합계"라 실물별로 나눌 근거가 없습니다.
  첫 인스턴스에 몰아 넣습니다. 실물에 UID 라벨을 붙인 뒤 현장에서 *소모품관리 > 타수 조정*으로 보정하는 것을 전제로 합니다.

---

## 2. 빌드 / 타입체크 / 테스트

```
pnpm build
pnpm test
```

제가 실행하지 못했습니다. 특히 아래 두 스펙은 **깨져 있을 가능성이 높습니다**(마스터 장착 기준으로 작성돼 있음):

- `apps/backend/src/modules/equipment/services/consumable.service.spec.ts` — **대폭 수정 필요**.
  삭제된 `mountToEquip` / `unmountFromEquip`(마스터)을 테스트하고 있음. 새 API인
  `forceUnmount(conUid)` / `setRepairStatus(conUid)` / `completeRepair(conUid)` 기준으로 재작성해야 함
- `apps/backend/src/modules/production/services/kiosk-consumable.service.spec.ts` — MOUNT/UNMOUNT 로그 기록이 추가돼 검토 필요

---

## 3. 마이그레이션 후 동작 검증

| # | 확인할 것 | 기대 결과 |
|---|---|---|
| 1 | 소모품 수명현황조회 | 200, UID 단위 목록 |
| 2 | 소모품 재고현황 | 200 |
| 3 | 소모품 장착관리 | 200, 롯트상태/UID/장착설비/수명% 컬럼 표시 |
| 4 | 장착관리에서 **강제해제** | 반환처(공정대기/양품/수리) 선택 → `CONSUMABLE_MOUNT_LOGS`에 UNMOUNT 1건 |
| 5 | 키오스크 스캔 장착 | `CONSUMABLE_STOCKS.STATUS='MOUNTED'`, MOUNT 로그 1건. 교체 시 이전 롯트 UNMOUNT 로그 |
| 6 | 생산실적 등록 | 장착 롯트의 `CURRENT_COUNT` 증가, `LIFE_STATUS` 재판정, USAGE 로그 |
| 7 | 수명 초과 | `LIFE_STATUS='REPLACE'` 전이 시 `EQUIP_MASTER.STATUS='INTERLOCK'` |

**타수 계산 규칙 (확정)**

```
누적 타수 = 소요량(USAGE_PER_UNIT, 매핑 미등록 시 1) × 실적수량
```

분류(금형·지그·공구·소모품)별 분기 **없음**. 단일 식입니다.

---

## 4. 미착수 — 중간 우선순위

- `product-traceability.service.ts` 금형 이력을 conUid 기준으로 전환 (아직 마스터 코드 기준)
- `ConsumableQueryDto`의 미구현 `operStatus` 필터 정리 (마스터 컬럼이라 이제 의미 없음)
- `docs/business-logics/CONS_MASTER.md` 갱신 (`CONS_MOUNT.md`는 갱신 완료)

---

## 5. 이번에 변경된 파일

**백엔드**

- `src/entities/consumable-stock.entity.ts` — `LIFE_STATUS` 컬럼 추가
- `src/modules/production/services/prod-result.service.ts` — `accrueConsumableUsageInTx` 전면 재작성 (마스터 경로 삭제, 롯트 단일 경로)
- `src/modules/production/services/kiosk-consumable.service.ts` — MOUNT/UNMOUNT 로그 기록 추가
- `src/modules/equipment/services/consumable.service.ts` — 마스터 장착 삭제, `forceUnmount`/`setRepairStatus`/`completeRepair` 신설
- `src/modules/equipment/controllers/consumable.controller.ts` — 라우트 `:id` → `:conUid`, `POST :id/mount` 삭제
- `src/modules/equipment/dto/consumable.dto.ts` — `UnmountFromEquipDto.returnTo` 추가
- `src/modules/equipment/equipment.module.ts` — `ConsumableStock` 등록
- `src/modules/consumables/controllers/consumable-stock.controller.ts` — `category`/`search` 필터, `warningCount` 응답 추가

**프론트엔드**

- `src/app/(authenticated)/consumables/mount/page.tsx` — 전면 재작성 (조회 + 강제해제 창구)
- `.../consumableMountColumns.tsx`, `.../consumableMountFieldHelp.tsx`
- `src/locales/{ko,en,vi,zh}.json`

**기타**

- `scripts/2026-09-14_consumable_mount_to_instance.sql` (신규)
- `docs/business-logics/CONS_MOUNT.md` (갱신)

---

## 6. 참고 — 발표자료

`THN_MES_소개서_20260914_v4.pptx` (30장) 작업 완료. 두 가지만 남아 있습니다.

- 28p 소모품 수명현황 캡쳐가 **타이틀 변경 전 화면**("수명현황")입니다. 재캡쳐 필요
- 원자재 업체 LOT 추적은 `invoiceNo`가 전부 null이고 API가 입력을 거부해 시드하지 못했습니다. 슬라이드에 각주로 명시해 둠

`apps\backend\uploads\iqc-certs\`의 임시 캡쳐 PNG 약 40개는 지시대로 보존 중입니다.
