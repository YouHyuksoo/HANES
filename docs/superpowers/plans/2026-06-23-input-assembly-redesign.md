# 조립공정 실적입력 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 조립 화면을 설비 자재 장착(WIP_MAT_STOCKS) + 반제품 세트 스캔 → FG 라벨 1장 발행 → 실물 라벨 스캔으로 매핑·소비·실적·재고를 확정하는 2단계 구조로 재구성한다.

**Architecture:** 자재는 설비 단위(`WIP_MAT_STOCKS`)에 스캔 장착(DB, 명시 해제 전 유지). 조립 실행은 FG 바코드 1개만 채번해 라벨 출력. 실물 FG 라벨 스캔 시 단일 트랜잭션으로 genealogy(FG→SG, FG→MAT_LOT) + SG 소비 + 설비 WIP 자재 BOM 차감 + ProdResult + FG WIP 재고를 확정. 기존 `kit()`은 보존하고 발행/확정 메서드를 신규 추가한다.

**Tech Stack:** NestJS + TypeORM(Oracle), Next.js(App Router) + React + react-i18next + Tailwind.

## Global Constraints

- 패키지 매니저 `pnpm`. dev 서버 실행 중 → `pnpm build` 금지. 타입체크 `pnpm --filter @harness/backend exec tsc --noEmit` / `--filter @harness/frontend exec tsc --noEmit` 0건.
- 모든 DB 조회/저장에 `COMPANY`, `PLANT_CD` 스코프. company 기본 인증 주입.
- N+1 금지(`In()` 일괄). `as any` 금지, `catch (error: unknown)` 유지, 에러 기본값 은폐 금지.
- `alert/confirm/prompt` 금지(모달). 파스텔 배경 배지 금지(text+border). 코드성 입력은 Select/콤보. 공통 UI `@/components/ui`, 아이콘 lucide-react, api `@/services/api`.
- flex 스크롤 영역 `min-h-0`. 페이지는 영역별 내부 스크롤(전체 스크롤 아님).
- i18n 변경 시 ko/en/zh/vi 4파일 동시, 누락 0, BOM 금지.
- 채번은 Oracle SEQUENCE(`NumberingService`). 단일 트랜잭션은 `this.tx.run(qr => ...)`, 채번/저장에 동일 qr 전달.
- 오투입 방지: 스캔 품목이 완제품 BOM에 없으면 거부. 제품 수량 = 1 고정.
- git add 파일 단위. 멀티라인 커밋 메시지 임시파일+`git commit -F`. 작업 시작 시 `.ai-coordination/LOCKS.md`에 잠금 등록.

## 기존 자산 (재사용)

| 자산 | 용도 |
|------|------|
| `WipMatStockService.addStockInTx(qr, {equipCode,itemCode,matUid,qty})` | 자재를 설비 WIP에 적재(장착) |
| `WipMatStockService.deductStockInTx(qr, {equipCode,itemCode,qty})` → `DeductedLot[]{matUid,qty}` | 설비 WIP 자재 FIFO 차감(조립 확정) |
| `WipMatStockService.restoreInTx` | WIP 복원(장착 해제 역분개) |
| `WipMatStock`(WIP_MAT_STOCKS) PK(company,plant,equipCode,itemCode,matUid) QTY/AVAILABLE_QTY | 설비 장착 자재 단일 출처 |
| `MatLot`(MAT_LOTS) matUid,itemCode,currentQty,vendor | 자재 LOT |
| `NumberingService.nextFgBarcode/nextProdResultNo/nextGenealogyId(qr)` | 채번 |
| `SubprocessKittingService.getAssemblyRequirements(orderNo)` | 완제품 BOM 반제품 요구사항 |
| `BomMaster`(parentItemCode, childItemCode, qtyPer, useYn) + `PartMaster.itemType`(SEMI_PRODUCT/RAW_MATERIAL) | BOM 오투입·자재 소요량 |
| `FgLabel`(status: ISSUED→...), `SgLabel`(remainQty,status), `ProductGenealogy`(FG→SG/MAT_LOT) | 라벨/매핑 |
| `TransactionService.tx.run` | 단일 트랜잭션 |

매핑 완료 판정: confirm 시 **genealogy 생성**으로 확정(별도 FG status 추가하지 않음 — 기존 흐름 보존). 라벨 미스캔 FG = genealogy 없는 `ISSUED` FG.

---

## Task 1: 백엔드 — 설비 자재 장착 서비스 + 컨트롤러

**Files:**
- Create: `apps/backend/src/modules/production/services/equip-material.service.ts`
- Create: `apps/backend/src/modules/production/controllers/equip-material.controller.ts`
- Create: `apps/backend/src/modules/production/dto/equip-material.dto.ts`
- Modify: production 모듈(`production.module.ts`) providers/controllers 등록

**Interfaces:**
- Produces:
  - `EquipMaterialService.mount(equipCode, matUid, company, plant, workerId?): Promise<MountedRow>`
  - `EquipMaterialService.listMounted(equipCode, company, plant): Promise<MountedRow[]>` (matUid 단위, 각 LOT 잔량)
  - `EquipMaterialService.unmount(equipCode, matUid, company, plant): Promise<void>`
  - `MountedRow = { equipCode; itemCode; itemName; matUid; qty; availableQty }`

- [ ] **Step 1: DTO 작성**
```ts
// equip-material.dto.ts
import { IsString } from 'class-validator';
export class MountMaterialDto { @IsString() equipCode: string; @IsString() matUid: string; }
export class UnmountMaterialDto { @IsString() equipCode: string; @IsString() matUid: string; }
```

- [ ] **Step 2: 서비스 작성**
- `mount`: `this.tx.run`으로 ① MAT_LOTS에서 matUid 조회(itemCode/currentQty, 없으면 NotFound) ② MAT_LOTS 잔량 전량을 설비 WIP로 이동 — `MatLot.currentQty`만큼 `wipMatStockService.addStockInTx(qr,{equipCode,itemCode,matUid,qty:currentQty})` + `MatLot.currentQty=0`(원자재창고→WIP 이동, 수불은 addStockInTx 내부) ③ 이미 그 설비에 장착된 동일 matUid면 BadRequest(중복). MountedRow 반환.
  > MAT_LOTS 잔량 전량 이동이 맞다(LOT 단위 설비 장착). 부분 장착은 범위 밖.
- `listMounted`: `WIP_MAT_STOCKS` repo로 `find({where:{equipCode,company,plant}})` → MAT_LOTS/ITEM_MASTERS와 itemName 매핑(In 일괄) → MountedRow[]. availableQty>0만.
- `unmount`: `this.tx.run` ① WIP_MAT_STOCKS(equipCode,matUid) 행 조회(잔량) ② `wipMatStockService` 역분개로 WIP 차감 + `MatLot.currentQty += 잔량`(원자재창고 복원). 잔량이 예약(RESERVED)되어 있으면 BadRequest. 
- 생성자: `@InjectRepository(WipMatStock)`, `@InjectRepository(MatLot)`, `@InjectRepository(PartMaster)`, `WipMatStockService`, `TransactionService`.

- [ ] **Step 3: 컨트롤러 작성**
```ts
@Controller('production/equip-material')
@UseGuards(JwtAuthGuard)
export class EquipMaterialController {
  constructor(private readonly svc: EquipMaterialService) {}
  @Post('mount')   mount(@Body() dto: MountMaterialDto, @Company() c, @Plant() p, @CurrentUser() u) { return ResponseUtil.success(...) }
  @Get('mounted')  listMounted(@Query('equipCode') eq, @Company() c, @Plant() p) { ... }
  @Post('unmount') unmount(@Body() dto: UnmountMaterialDto, @Company() c, @Plant() p) { ... }
}
```
실제 데코레이터(`@Company`/`@Plant`/`@CurrentUser`)와 `ResponseUtil`은 기존 컨트롤러(`subprocess-kitting.controller.ts`) 패턴 그대로.

- [ ] **Step 4: 모듈 등록 + 타입체크**
production 모듈에 service/controller 등록, `WipMatStock`/`MatLot`/`PartMaster` forFeature 확인(없으면 추가).
Run: `pnpm --filter @harness/backend exec tsc --noEmit` → 0건.

- [ ] **Step 5: 실DB 검증 + 커밋**
임의 설비/자재 LOT로 mount → `WIP_MAT_STOCKS` 적재 + MAT_LOTS 차감 확인, listMounted 복원 확인, unmount 역분개 확인(쿼리). 파일 단위 add 후 커밋 `feat(assembly): 설비 자재 장착 API`.

---

## Task 2: 백엔드 — 조립 라벨 발행 + 라벨 스캔 확정

**Files:**
- Modify: `apps/backend/src/modules/production/services/subprocess-kitting.service.ts` (메서드 추가)
- Modify: `apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts` (엔드포인트 추가)
- Modify: `apps/backend/src/modules/production/dto/subprocess-kitting.dto.ts` (DTO 추가)

**Interfaces:**
- Consumes: Task 1의 설비 WIP 자재(`WipMatStockService.deductStockInTx`)
- Produces:
  - `issueLabel(orderNo, equipCode, company, plant, workerId?): Promise<{ fgBarcode: string }>`
  - `confirmAssembly(dto: ConfirmAssemblyDto, company, plant, workerId?): Promise<{ resultNo: string; fgBarcode: string }>`
  - `ConfirmAssemblyDto = { fgBarcode; orderNo; equipCode; processCode; sgBarcodes: string[]; circuitNo?: string }`

- [ ] **Step 1: DTO 추가**
```ts
export class IssueLabelDto { @IsString() orderNo: string; @IsString() equipCode: string; }
export class ConfirmAssemblyDto {
  @IsString() fgBarcode: string;
  @IsString() orderNo: string;
  @IsString() equipCode: string;
  @IsString() processCode: string;
  @IsArray() @IsString({ each: true }) sgBarcodes: string[];
  @IsOptional() @IsString() circuitNo?: string;
}
```

- [ ] **Step 2: `issueLabel` 구현 (② 발행)**
`this.tx.run`: ① 작업지시 조회+완제품 검증(kit Step1 패턴) ② `nextFgBarcode(qr)` ③ FgLabel 저장 status='ISSUED', itemCode=jobOrder.itemCode, orderNo, equipCode, workerId. **SG/자재/실적/재고 미반영.** return `{ fgBarcode }`.

- [ ] **Step 3: `confirmAssembly` 구현 (③ 확정)**
`this.tx.run` 단일 트랜잭션:
1. FgLabel(fgBarcode) 조회 — status='ISSUED'·orderNo 일치 확인(아니면 BadRequest). 이미 genealogy 있으면 중복확정 BadRequest.
2. 완제품 BOM 조회(kit 패턴) → `semiCodeSet`(SEMI_PRODUCT), `rawCodeSet`+qtyPer(RAW_MATERIAL).
3. SG 검증(kit Step3): 존재/status(IN_STOCK·MOUNTED)/remainQty>0/`semiCodeSet` 포함(오투입). 
4. SG 소비(제품 1개분): 각 스캔 SG에서 1씩 차감 — `sg.remainQty -= 1; sg.status = remainQty===0?'CONSUMED':'MOUNTED'; sg.currentProcessCode=processCode`; genealogy FG→SG(qty:1) 저장.
5. 자재 차감(설비 WIP, BOM 소요량): `rawCodeSet`의 각 itemCode에 대해 `deductStockInTx(qr,{equipCode,itemCode,qty:qtyPer})` → `DeductedLot[]`. 각 lot마다 genealogy FG→MAT_LOT(childKey=lot.matUid, qty:lot.qty) 저장. WIP 부족 시 deductStockInTx가 throw → 롤백.
6. `nextProdResultNo(qr)` → ProdResult 저장(orderNo, processCode, goodQty:1, status:'DONE', startAt/endAt:now, equipCode, workerId).
7. FG WIP 재고 적재(기존 kit의 제품 WIP 적재 로직 `productInventory`/`adsorbProductStockInTx`와 동일 — kit 코드에서 해당 호출 확인 후 동일 적용).
8. return `{ resultNo, fgBarcode }`.

> 기존 `kit()`은 변경하지 않는다(키오스크/타 사용처 보존). 위 로직은 kit에서 필요한 부분만 발췌·재구성하되 자재는 설비 WIP 차감으로 대체.

- [ ] **Step 4: 컨트롤러 엔드포인트 추가**
```ts
@Post('issue-label') issueLabel(@Body() dto: IssueLabelDto, ...) { ... }
@Post('confirm')     confirm(@Body() dto: ConfirmAssemblyDto, ...) { ... }
```

- [ ] **Step 5: 타입체크 + 실DB 검증 + 커밋**
`tsc --noEmit` 0건. 실DB: issue-label → FG ISSUED 1건(genealogy 없음), confirm → genealogy(FG→SG, FG→MAT_LOT) + SG 잔량↓ + WIP_MAT_STOCKS↓ + ProdResult 생성 확인. 커밋 `feat(assembly): 조립 라벨 발행+확정 2단계 API`.

---

## Task 3: 프론트 — 설비 자재 장착 패널

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/input-assembly/components/EquipMaterialMountPanel.tsx`

**Interfaces:**
- Consumes: Task 1 API (`/production/equip-material/{mount,mounted,unmount}`)
- Produces: `EquipMaterialMountPanel({ equipCode }: { equipCode: string })`

- [ ] **Step 1: 컴포넌트 작성**
- equipCode 변경 시 `GET /production/equip-material/mounted?equipCode=`로 장착 목록 복원(useEffect).
- 상단 **고정** 자재 스캔 입력(작게) — Enter 시 `POST mount {equipCode, matUid}`, 성공 시 목록 갱신, 실패(오장착/중복) toast.
- 목록: 품목·LOT·잔량(availableQty), 각 행 `[해제]` 버튼 → `POST unmount`. availableQty 0이면 "보충 스캔" 안내 텍스트.
- 영역 내부 스크롤(`min-h-0`). equipCode 없으면 "설비를 먼저 선택" 안내.
- i18n `t(key, fallback)`(키는 Task 5).

- [ ] **Step 2: 타입체크 + 커밋**
`pnpm --filter @harness/frontend exec tsc --noEmit` 0건. 커밋 `feat(assembly): 설비 자재 장착 패널`.

---

## Task 4: 프론트 — 반제품 패널 + page 재작성 + 액션바

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/input-assembly/components/SgScanPanel.tsx`
- Create: `apps/frontend/src/app/(authenticated)/production/input-assembly/components/AssemblyActionBar.tsx`
- Modify(전면 재작성): `apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx`

**Interfaces:**
- Consumes: Task 2 API, Task 3 패널, 기존 `JobOrderSearchModal`, `assembly-requirements`
- Produces: `SgScanPanel({ orderNo, sgList, onScan, onRemove })`, `AssemblyActionBar({ canIssue, onIssue, issuedFg, onConfirmScan })`

- [ ] **Step 1: SgScanPanel 작성**
- 상단 **고정** 반제품 스캔 입력(작게) — Enter 시 SG 라벨 조회(`GET subprocess-kitting/sg-label/{barcode}`) + 중복/FG오입력/잔량/상태/BOM품목(오투입) 검증 후 목록 추가(기존 page.tsx 검증 로직 재사용).
- 목록: 품목·SG바코드·잔량, 각 행 제거. BOM 충족(오투입만) 표시. 내부 스크롤.

- [ ] **Step 2: AssemblyActionBar 작성**
- 좌: `[조립 실행 → FG 라벨 발행]` 버튼 → `POST issue-label {orderNo, equipCode}` → 발행된 fgBarcode 표시 + 라벨 출력(기존 라벨 출력 훅 있으면 사용, 없으면 fgBarcode 모달 안내).
- 우: 발행 후 활성화되는 `[실물 라벨 스캔]` 입력 → Enter 시 `POST confirm {fgBarcode(스캔값), orderNo, equipCode, processCode, sgBarcodes}` → 성공 시 반제품 목록 리셋 + 완료 toast. 스캔값이 발행 fgBarcode와 불일치면 경고.

- [ ] **Step 3: page.tsx 전면 재작성 (레이아웃)**
- `h-full flex flex-col overflow-hidden p-5 gap-3`.
- 상단 고정 바: 작업지시(완제품) 선택(컴팩트, 기존 JobOrderSearchModal/스캔) + 설비 Select(useEquipOptions) + 초기화.
- 본문 2열 `grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0`: 좌 `EquipMaterialMountPanel`(equipCode), 우 `SgScanPanel`.
- 하단 고정 `AssemblyActionBar`. 작업지시·설비 선택 전엔 비활성.
- 기존 BOM 요구사항/실행 카드/qty 입력 제거. 공정코드는 작업지시/설비에서 유도하거나 Select 1개로 최소화.

- [ ] **Step 4: 타입체크 + 커밋**
`tsc --noEmit` 0건. 커밋 `feat(assembly): 조립 화면 2영역 재구성(자재장착/반제품+액션바)`.

---

## Task 5: i18n + 최종 검증

**Files:**
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`

- [ ] **Step 1: 신규 키 4파일 추가**
`production.inputAssembly`(및 필요한 production.equipMaterial)에 신규 라벨 키 추가 — 자재장착/보충스캔/해제/반제품스캔/조립실행/라벨발행/실물라벨스캔/확정완료/설비선택안내/오투입 등. 코드에서 `t("...", fallback)`로 쓴 키 전부. ko 기준 작성 후 en/zh/vi 번역. BOM 금지, additive only(다른 세션 locales 잠금 시 충돌 회피).

- [ ] **Step 2: 누락 키 검증 + 최종 타입체크**
Grep으로 신규 키 4파일 대칭 확인. `pnpm --filter @harness/frontend exec tsc --noEmit` + `--filter @harness/backend exec tsc --noEmit` 0건.

- [ ] **Step 3: 통합 검증 + 커밋**
화면(`/production/input-assembly`): 설비 선택 → 자재 장착(복원/해제) → 반제품 스캬 → 조립 실행(FG 라벨) → 실물 라벨 스캔 → 확정. 추적성 화면에서 그 FG 조회 시 반제품·자재 매핑 표시. 커밋 `feat(assembly): i18n 4파일`. LOCKS 잠금 해제 + JOURNAL 기록(별도 커밋).

---

## Self-Review (스펙 대비)
- ✅ 2단계 커밋(발행/확정) — Task 2
- ✅ 설비 자재 장착(WIP_MAT_STOCKS, DB, 복원/해제) — Task 1·3
- ✅ 반제품 세트 스캔·리셋 — Task 4(SgScanPanel)
- ✅ 라벨 스캔 시 genealogy+SG소비+자재BOM차감+실적+재고 단일TX — Task 2 confirmAssembly
- ✅ 오투입(BOM 품목) 방지·제품 수량 1·자재 BOM 소요량 차감 — Task 2
- ✅ 고정 스캔 영역 2열 레이아웃 — Task 4
- ✅ 기존 kit() 보존 — Task 2
- 비범위: 키오스크 자재 모델 전환(별도 단계).

**확인 필요(구현 중):** kit()의 FG WIP 재고 적재 호출(`productInventory`/`adsorbProductStockInTx`) 정확한 시그니처 — Task 2 Step3-7에서 kit 코드 확인 후 동일 적용. 라벨 출력 훅 존재 여부 — Task 4 Step2.
