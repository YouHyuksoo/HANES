# FG 바코드 발행 타이밍 가변 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SysConfig 설정으로 FG 바코드 발행 타이밍을 ON_INSPECT/ON_PRODUCTION/PRE_ISSUE 모드로 전환

**Architecture:** 기존 ContinuityInspectService.inspect()에 모드 분기 추가. ON_PRODUCTION은 ProdResultService.create()에, PRE_ISSUE는 JobOrderService.start()에 바코드 사전 발행 로직 연계. FgLabel 엔티티에 PENDING 상태와 inspectPassYn 필드 추가.

**Tech Stack:** NestJS, TypeORM, Oracle DB, Next.js React

**Spec:** `docs/superpowers/specs/2026-03-19-fg-barcode-issue-timing-design.md`

---

## 파일 맵

### 백엔드 수정
| 파일 | 변경 |
|------|------|
| `apps/backend/src/entities/fg-label.entity.ts` | `inspectPassYn` 컬럼 추가 |
| `apps/backend/src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts` | `fgBarcode?` 필드 추가, PreIssueDto/ReInspectDto 신규 |
| `apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts` | inspect() 모드 분기, preIssue(), getPending(), reInspect() 추가 |
| `apps/backend/src/modules/quality/continuity-inspect/controllers/continuity-inspect.controller.ts` | 신규 3개 라우트 추가 |
| `apps/backend/src/modules/production/services/prod-result.service.ts` | create()에 ON_PRODUCTION 바코드 발행 |
| `apps/backend/src/modules/production/services/job-order.service.ts` | start()에 PRE_ISSUE 일괄 발행 |

### 프론트엔드 수정
| 파일 | 변경 |
|------|------|
| `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx` | 모드별 UI 분기 (스캔 입력 필드 추가) |
| `apps/frontend/src/app/(authenticated)/production/order/page.tsx` | PRE_ISSUE 사전발행 버튼+모달 |

---

### Task 1: DB DDL + 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/fg-label.entity.ts`
- DB: `JSHANES` site — `ALTER TABLE FG_LABELS ADD INSPECT_PASS_YN VARCHAR2(1) NULL`

- [ ] **Step 1: DB에 컬럼 추가**

```bash
python C:/Project/scripts/oracle_connector.py --site JSHANES --query "ALTER TABLE FG_LABELS ADD INSPECT_PASS_YN VARCHAR2(1) NULL"
```

- [ ] **Step 2: 엔티티에 필드 추가**

`fg-label.entity.ts`에 `inspectResultId` 필드 근처에 추가:
```typescript
@Column({ name: 'INSPECT_PASS_YN', length: 1, nullable: true })
inspectPassYn: string | null;
```

- [ ] **Step 3: SysConfig 기본값 등록**

```bash
python C:/Project/scripts/oracle_connector.py --site JSHANES --query "INSERT INTO SYS_CONFIGS (CONFIG_KEY, CONFIG_VALUE, DESCRIPTION, IS_ACTIVE, COMPANY, PLANT_CD) VALUES ('FG_BARCODE_ISSUE_TIMING', 'ON_INSPECT', 'FG 바코드 발행 타이밍 (ON_INSPECT/ON_PRODUCTION/PRE_ISSUE)', 'Y', '40', '1000')"
```

- [ ] **Step 4: 빌드 확인**

```bash
pnpm build --filter @harness/backend
```

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/entities/fg-label.entity.ts
git commit -m "feat(fg-label): add INSPECT_PASS_YN column + SysConfig setting"
```

---

### Task 2: DTO 추가

**Files:**
- Modify: `apps/backend/src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts`

- [ ] **Step 1: ContinuityInspectDto에 fgBarcode 선택 필드 추가**

기존 `ContinuityInspectDto` 클래스에 추가:
```typescript
@ApiPropertyOptional({ description: 'FG 바코드 (ON_PRODUCTION/PRE_ISSUE 모드에서 스캔값)' })
@IsOptional()
@IsString()
@MaxLength(30)
fgBarcode?: string;
```

- [ ] **Step 2: PreIssueDto 신규 클래스 추가**

```typescript
export class PreIssueDto {
  @ApiProperty({ description: '작업지시번호' })
  @IsString()
  orderNo: string;

  @ApiPropertyOptional({ description: '발행 수량 (미지정 시 planQty-기발행수)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;
}
```

- [ ] **Step 3: ReInspectDto 신규 클래스 추가**

```typescript
export class ReInspectDto {
  @ApiProperty({ description: '재검사 결과', enum: ['Y', 'N'] })
  @IsString()
  @IsIn(['Y', 'N'])
  passYn: string;

  @ApiPropertyOptional({ description: '불량코드' })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}
```

- [ ] **Step 4: 빌드 확인 + 커밋**

---

### Task 3: ContinuityInspectService 모드 분기

**Files:**
- Modify: `apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts`

- [ ] **Step 1: SysConfigService 주입 추가**

constructor에 `private readonly sysConfigService: SysConfigService` 추가.
module.ts에서 SystemModule import 또는 SysConfigService provider 확인.

- [ ] **Step 2: inspect() 메서드에 모드 분기 추가**

기존 inspect() 메서드(164-258줄)를 수정:

```typescript
async inspect(dto, company, plant) {
  const timing = await this.sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING') ?? 'ON_INSPECT';

  // ... 기존 JobOrder 조회, InspectResult 생성 ...

  if (timing === 'ON_INSPECT') {
    // 기존 로직 유지: PASS 시 채번 + FG_LABELS INSERT(ISSUED)
  } else {
    // ON_PRODUCTION / PRE_ISSUE: 스캔된 바코드 매칭
    if (!dto.fgBarcode) throw new BadRequestException('바코드 스캔이 필요합니다.');
    const label = await queryRunner.manager.findOne(FgLabel, { where: { fgBarcode: dto.fgBarcode } });
    if (!label || label.status !== 'PENDING') throw new BadRequestException('유효하지 않은 바코드입니다.');

    label.status = 'ISSUED';
    label.inspectPassYn = dto.passYn;
    label.inspectResultId = savedInspect.resultNo;
    await queryRunner.manager.save(FgLabel, label);

    fgBarcode = dto.fgBarcode;
  }

  // goodQty/defectQty 처리는 모드 무관하게 동일
}
```

- [ ] **Step 3: preIssue() 메서드 추가**

```typescript
async preIssue(dto: PreIssueDto, company: string, plant: string) {
  const jobOrder = await this.jobOrderRepo.findOne({ where: { orderNo: dto.orderNo } });
  if (!jobOrder) throw new NotFoundException('작업지시를 찾을 수 없습니다.');

  const existingCount = await this.fgLabelRepo.count({ where: { orderNo: dto.orderNo } });
  const issueQty = dto.qty ?? (jobOrder.planQty - existingCount);
  if (issueQty <= 0) throw new BadRequestException('발행할 수량이 없습니다.');

  const qr = this.dataSource.createQueryRunner();
  await qr.connect(); await qr.startTransaction();
  try {
    const barcodes: string[] = [];
    for (let i = 0; i < issueQty; i++) {
      const fgBarcode = await this.seqGenerator.nextFgBarcode(qr);
      await qr.manager.save(FgLabel, {
        fgBarcode, itemCode: jobOrder.itemCode, orderNo: dto.orderNo,
        status: 'PENDING', inspectPassYn: null, company, plant,
      });
      barcodes.push(fgBarcode);
    }
    await qr.commitTransaction();
    return { orderNo: dto.orderNo, issuedCount: barcodes.length, barcodes };
  } catch (err) { await qr.rollbackTransaction(); throw err; }
  finally { await qr.release(); }
}
```

- [ ] **Step 4: getPendingLabels() 메서드 추가**

```typescript
async getPendingLabels(orderNo: string) {
  return this.fgLabelRepo.find({
    where: { orderNo, status: 'PENDING' },
    order: { createdAt: 'ASC' },
  });
}
```

- [ ] **Step 5: reInspect() 메서드 추가**

```typescript
async reInspect(fgBarcode: string, dto: ReInspectDto, company: string, plant: string) {
  const label = await this.fgLabelRepo.findOne({ where: { fgBarcode } });
  if (!label) throw new NotFoundException('바코드를 찾을 수 없습니다.');
  if (label.status !== 'ISSUED' || label.inspectPassYn !== 'N')
    throw new BadRequestException('FAIL 상태의 바코드만 재검사할 수 있습니다.');

  const qr = this.dataSource.createQueryRunner();
  await qr.connect(); await qr.startTransaction();
  try {
    // 새 InspectResult 생성
    const resultNo = await this.seqGenerator.getNo('INSPECT_RESULT', qr);
    const inspect = qr.manager.create(InspectResult, {
      resultNo, prodResultNo: null, passYn: dto.passYn,
      fgBarcode, inspectType: 'CONTINUITY', inspectScope: 'FULL',
      errorCode: dto.errorCode ?? null, company, plant,
    });
    await qr.manager.save(InspectResult, inspect);

    // FgLabel 업데이트
    const prevPassYn = label.inspectPassYn;
    label.inspectPassYn = dto.passYn;
    label.inspectResultId = resultNo;
    await qr.manager.save(FgLabel, label);

    // JobOrder 수량 보정
    if (dto.passYn === 'Y' && prevPassYn === 'N') {
      await qr.manager.increment(JobOrder, { orderNo: label.orderNo }, 'goodQty', 1);
      await qr.manager.decrement(JobOrder, { orderNo: label.orderNo }, 'defectQty', 1);
    }

    await qr.commitTransaction();
    return { fgBarcode, passYn: dto.passYn, inspectResultNo: resultNo };
  } catch (err) { await qr.rollbackTransaction(); throw err; }
  finally { await qr.release(); }
}
```

- [ ] **Step 6: 빌드 확인 + 커밋**

---

### Task 4: 컨트롤러 신규 라우트 추가

**Files:**
- Modify: `apps/backend/src/modules/quality/continuity-inspect/controllers/continuity-inspect.controller.ts`

- [ ] **Step 1: 3개 라우트 추가**

```typescript
@Post('pre-issue')
async preIssue(@Body() dto: PreIssueDto, @Company() company: string, @Plant() plant: string) {
  const data = await this.service.preIssue(dto, company, plant);
  return ResponseUtil.success(data, `${data.issuedCount}건의 바코드가 발행되었습니다.`);
}

@Get('pending/:orderNo')
async getPending(@Param('orderNo') orderNo: string) {
  const data = await this.service.getPendingLabels(orderNo);
  return ResponseUtil.success(data);
}

@Post('re-inspect/:fgBarcode')
async reInspect(
  @Param('fgBarcode') fgBarcode: string,
  @Body() dto: ReInspectDto,
  @Company() company: string, @Plant() plant: string,
) {
  const data = await this.service.reInspect(fgBarcode, dto, company, plant);
  return ResponseUtil.success(data);
}
```

- [ ] **Step 2: DTO import 추가 + 빌드 확인 + 커밋**

---

### Task 5: ProdResultService — ON_PRODUCTION 연계

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts`

- [ ] **Step 1: create() 메서드에 ON_PRODUCTION 바코드 발행 추가**

create() 메서드의 `await queryRunner.manager.save(ProdResult, prodResult)` 직후, 자재 자동차감 이전에:

```typescript
// FG 바코드 사전 발행 (ON_PRODUCTION 모드)
const fgTiming = await this.sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING');
if (fgTiming === 'ON_PRODUCTION') {
  const fgBarcode = await this.seqGenerator.nextFgBarcode(queryRunner);
  await queryRunner.manager.save(FgLabel, {
    fgBarcode, itemCode: jobOrder.itemCode, orderNo: dto.orderNo,
    status: 'PENDING', inspectPassYn: null, company, plant,
  });
  saved.prdUid = fgBarcode;
  await queryRunner.manager.update(ProdResult, saved.resultNo, { prdUid: fgBarcode });
}
```

- [ ] **Step 2: FgLabel, SysConfigService import + 주입 확인**

SysConfigService가 ProductionModule에서 사용 가능한지 확인. SystemModule export 또는 직접 provider 등록.

- [ ] **Step 3: 빌드 확인 + 커밋**

---

### Task 6: JobOrderService — PRE_ISSUE 연계

**Files:**
- Modify: `apps/backend/src/modules/production/services/job-order.service.ts`

- [ ] **Step 1: start() 메서드에 PRE_ISSUE 일괄 발행 추가**

start() 메서드의 상태 변경(`status='RUNNING'`) 직후:

```typescript
// FG 바코드 사전 일괄 발행 (PRE_ISSUE 모드)
const fgTiming = await this.sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING');
if (fgTiming === 'PRE_ISSUE') {
  const jobOrder = await this.findById(id);
  for (let i = 0; i < jobOrder.planQty; i++) {
    const fgBarcode = await this.seqGenerator.nextFgBarcode();
    await this.fgLabelRepo.save({
      fgBarcode, itemCode: jobOrder.itemCode, orderNo: jobOrder.orderNo,
      status: 'PENDING', inspectPassYn: null,
      company: jobOrder.company, plant: jobOrder.plant,
    });
  }
  this.logger.log(`PRE_ISSUE: ${jobOrder.orderNo} — ${jobOrder.planQty}건 바코드 발행`);
}
```

- [ ] **Step 2: FgLabel Repository, SysConfigService, SeqGeneratorService 주입 확인**

- [ ] **Step 3: 빌드 확인 + 커밋**

---

### Task 7: 프론트엔드 — 통전검사 페이지 모드 분기

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx`

- [ ] **Step 1: SysConfig 조회 hook 추가**

```typescript
const [issueTiming, setIssueTiming] = useState<string>('ON_INSPECT');
useEffect(() => {
  api.get('/system/configs/FG_BARCODE_ISSUE_TIMING').then(res => {
    setIssueTiming(res.data?.data?.configValue ?? 'ON_INSPECT');
  }).catch(() => {});
}, []);
```

- [ ] **Step 2: 스캔 모드 UI 추가**

ON_PRODUCTION/PRE_ISSUE 모드일 때:
- 바코드 스캔 입력 필드 (Input + Enter 키 핸들러)
- PENDING 바코드 목록 표시 (`GET /quality/continuity-inspect/pending/:orderNo`)
- 스캔 후 PASS/FAIL 판정 버튼

- [ ] **Step 3: inspect API 호출에 fgBarcode 파라미터 추가**

```typescript
const payload = {
  orderNo, itemCode, passYn, equipCode, workerId, lineCode,
  ...(issueTiming !== 'ON_INSPECT' && { fgBarcode: scannedBarcode }),
};
await api.post('/quality/continuity-inspect/inspect', payload);
```

- [ ] **Step 4: 빌드 확인 + 커밋**

---

### Task 8: 프론트엔드 — 작업지시 사전발행 버튼

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/order/page.tsx`

- [ ] **Step 1: PRE_ISSUE 모드 감지**

```typescript
const [issueTiming, setIssueTiming] = useState<string>('ON_INSPECT');
useEffect(() => { /* SysConfig 조회 */ }, []);
```

- [ ] **Step 2: 사전발행 버튼 + 모달 추가**

작업지시 상세 영역에 `issueTiming === 'PRE_ISSUE'`일 때:
- "바코드 사전발행" 버튼 표시
- 클릭 시 수량 입력 모달 (기본값=planQty)
- 확인 → `POST /quality/continuity-inspect/pre-issue` 호출
- 발행된 바코드 목록 표시

- [ ] **Step 3: i18n 키 추가 (4개 언어)**

```
production.order.preIssueBtn: "바코드 사전발행"
production.order.preIssueQty: "발행 수량"
production.order.preIssueSuccess: "{{count}}건의 바코드가 발행되었습니다."
```

- [ ] **Step 4: 빌드 확인 + 커밋**
