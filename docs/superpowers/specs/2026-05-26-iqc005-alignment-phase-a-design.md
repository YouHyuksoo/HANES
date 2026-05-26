# IQC005 자재 입하관리 정렬 — Phase A 디자인

> 작성일: 2026-05-26
> 상태: 디자인 승인 (사용자)
> 관련 문서:
> - `docs/standards/numbering-rules.md` — 채번 규칙 단일 출처
> - 목업: `C:/Users/hsyou/Desktop/iqc-mockup-screens.html` (PAGE 7–8)
> - 채번 PDF: `C:/Users/hsyou/Desktop/HANES_MES_채번규칙.pdf`

## 1. 목표

목업 IQC005를 기준으로 `/material/arrival` 페이지를 재구조화하고, 자재 시리얼 채번 + 입하 트랜잭션 + 라벨 미리보기 흐름을 통합한다.

## 2. 스코프

### Phase A 포함
- DB: 제조사 컬럼 신설, 일별 채번 SEQUENCE 2개, DBMS_SCHEDULER 리셋 잡 2개
- 백엔드: `MatSerialNumberService` 신설, 입하 서비스 개편 (시리얼 N건 발급 로직)
- 프론트: PO 라인 단위 메인 그리드, 1라인 1팝업, 라벨 미리보기 모달
- i18n: ko/en/zh/vi 4파일 동기화

### Phase A 제외
- 자재 분할/병합 (Phase D)
- 입하실적조회 페이지 신규 (Phase B → `/material/receive-history`)
- 라벨 백엔드/프린터 통합 (Phase C — 브라우저 print만)
- 자투리 별도 시리얼 발급 정책 (Phase B에서 명확화)
- IQC006의 재인쇄 (Phase C)

## 3. 데이터 모델

### 3-1. 기존 컬럼 재활용 (변경 없음)

| 테이블 | 컬럼 | 의미 |
|---|---|---|
| `ITEM_MASTERS` | `LOT_UNIT_QTY` | 시리얼 1건당 수량 단위. NULL이면 단일 LOT로 발급 |
| `MAT_LOTS` | `ARRIVAL_NO`, `ARRIVAL_SEQ` | 입하실적코드. 같은 값 = 동일 LOT |
| `MAT_LOTS` | `ORIGIN` | 분할 시 root_serial 추적 (Phase D에서 활용) |
| `MAT_LOTS` | `INIT_QTY` | 시리얼 단위 발급 수량 (자투리 LOT는 잔여 수량) |
| `MAT_LOTS` | `VENDOR`, `INVOICE_NO`, `PO_NO`, `MANUFACTURE_DATE` | 기존 사용 |
| `PARTNER_MASTERS` | `PARTNER_TYPE` | 'CUSTOMER' / 'SUPPLIER' / 'MFG' (신규 코드값) |

### 3-2. 신규 컬럼 (마이그레이션 1개)

```sql
-- 2026-05-26_iqc005_mat_lots_mfg_code.sql
ALTER TABLE MAT_LOTS ADD (MFG_PARTNER_CODE VARCHAR2(50));
COMMENT ON COLUMN MAT_LOTS.MFG_PARTNER_CODE IS '제조사 거래처코드 (PARTNER_MASTERS.PARTNER_CODE)';
CREATE INDEX IX_MAT_LOTS_MFG ON MAT_LOTS(MFG_PARTNER_CODE);
```

엔티티에 컬럼 추가:
```ts
// apps/backend/src/entities/mat-lot.entity.ts
@Column({ type: 'varchar2', name: 'MFG_PARTNER_CODE', length: 50, nullable: true })
mfgPartnerCode: string | null;
```

### 3-3. 채번 SEQUENCE (마이그레이션 1개)

```sql
-- 2026-05-26_iqc005_serial_sequences.sql
CREATE SEQUENCE SEQ_MAT_SERIAL_DAILY
  START WITH 1 INCREMENT BY 1 MAXVALUE 99999 NOCYCLE NOCACHE ORDER;

CREATE SEQUENCE SEQ_ARRIVAL_NO_DAILY
  START WITH 1 INCREMENT BY 1 MAXVALUE 99999 NOCYCLE NOCACHE ORDER;
```

> `NOCACHE ORDER` 채택 이유: 일별 리셋 + 순번이 시간순 정렬과 일치해야 운영자가 시리얼/입하번호로 발생 순서를 추론 가능. 성능 영향은 입하 트랜잭션 빈도(분당 수십 건 이내)에서 무시 가능.

### 3-4. 일별 리셋 잡 (마이그레이션 1개)

```sql
-- 2026-05-26_iqc005_daily_reset_jobs.sql
BEGIN
  DBMS_SCHEDULER.CREATE_JOB(
    job_name   => 'JOB_RESET_MAT_SERIAL_DAILY',
    job_type   => 'PLSQL_BLOCK',
    job_action => 'BEGIN EXECUTE IMMEDIATE ''ALTER SEQUENCE SEQ_MAT_SERIAL_DAILY RESTART START WITH 1''; END;',
    start_date => TRUNC(SYSDATE) + 1,  -- 다음 자정
    repeat_interval => 'FREQ=DAILY; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
    enabled    => TRUE
  );

  DBMS_SCHEDULER.CREATE_JOB(
    job_name   => 'JOB_RESET_ARRIVAL_NO_DAILY',
    job_type   => 'PLSQL_BLOCK',
    job_action => 'BEGIN EXECUTE IMMEDIATE ''ALTER SEQUENCE SEQ_ARRIVAL_NO_DAILY RESTART START WITH 1''; END;',
    start_date => TRUNC(SYSDATE) + 1,
    repeat_interval => 'FREQ=DAILY; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
    enabled    => TRUE
  );
END;
/
```

> `ALTER SEQUENCE ... RESTART`는 Oracle 12.2+ 지원. JSHANES 운영 버전 12.2 이상 가정 (배포 전 확인 필요).

### 3-5. 시드 (마이그레이션 1개)

```sql
-- 2026-05-26_iqc005_seed_mfg_partners.sql
INSERT INTO PARTNER_MASTERS (PARTNER_CODE, PARTNER_NAME, PARTNER_TYPE, USE_YN, COMPANY, PLANT_CD, CREATED_BY, ...)
VALUES ('M001', '한성정밀', 'MFG', 'Y', '40', '1000', 'SYSTEM', ...);
-- ... 5건 (한성정밀/비나마이크로/ABC Industries 등)

-- 기존 RM ITEM_MASTERS에 LOT_UNIT_QTY 보강 (NULL인 행만)
UPDATE ITEM_MASTERS SET LOT_UNIT_QTY = 50
WHERE ITEM_TYPE = 'RM' AND LOT_UNIT_QTY IS NULL AND COMPANY = '40';
```

## 4. 백엔드 변경

### 4-1. 신규 서비스

**파일:** `apps/backend/src/modules/material/services/mat-serial-number.service.ts`

```ts
const MAT_SERIAL_PREFIX = 'VH1-RM';  // 회사 표준 상수 (PLANT_CD와 매핑 관계 없음)

@Injectable()
export class MatSerialNumberService {
  constructor(private readonly dataSource: DataSource) {}

  async nextMatSerial(txDate: Date = new Date()): Promise<string> {
    const [{ NEXT_SEQ: seq }] = await this.dataSource.query(
      'SELECT SEQ_MAT_SERIAL_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    return `${MAT_SERIAL_PREFIX}${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }

  async nextMatSerialBatch(count: number, txDate: Date = new Date()): Promise<string[]> {
    // CONNECT BY로 N개 한번에 채번
    const rows = await this.dataSource.query(
      `SELECT SEQ_MAT_SERIAL_DAILY.NEXTVAL AS "NEXT_SEQ"
       FROM DUAL CONNECT BY LEVEL <= :count`,
      [count],
    );
    return rows.map((r: any) => `${MAT_SERIAL_PREFIX}${this.yyMMdd(txDate)}-${this.pad5(r.NEXT_SEQ)}`);
  }

  async nextArrivalNo(txDate: Date = new Date()): Promise<string> {
    const [{ NEXT_SEQ: seq }] = await this.dataSource.query(
      'SELECT SEQ_ARRIVAL_NO_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    return `R${this.yyMMdd(txDate)}${this.pad5(seq)}`;
  }

  private yyMMdd(d: Date): string {
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }
  private pad5(n: number): string { return String(n).padStart(5, '0'); }
}
```

### 4-2. 입하 서비스 개편

**파일:** `apps/backend/src/modules/material/services/arrival.service.ts`

**입력 DTO:**
```ts
class PoLineReceiptDto {
  @IsString() poItemId: string;
  @IsInt() @Min(1) receivedQty: number;
  @IsString() @IsNotEmpty() mfgPartnerCode: string;  // 신규 필수
  @IsDateString() receivedDate: string;
  @IsOptional() @IsString() remark?: string;
}
```

**메서드:** `receivePoLine(dto, user)`
```ts
async receivePoLine(dto: PoLineReceiptDto, user: User) {
  return this.tx.runInTransaction(async (manager) => {
    // 1. PO 라인 조회 + 잔량 검증
    const poItem = await manager.findOne(PoItem, { where: { id: dto.poItemId } });
    if (!poItem) throw new NotFoundException('PO 라인 없음');
    if (dto.receivedQty > poItem.remainingQty) {
      throw new BadRequestException(`잔량 ${poItem.remainingQty} 초과`);
    }

    // 2. 제조사 검증
    const mfg = await manager.findOne(PartnerMaster, {
      where: { partnerCode: dto.mfgPartnerCode, partnerType: 'MFG' },
    });
    if (!mfg) throw new BadRequestException('제조사 없음');

    // 3. 시리얼 단위 조회
    const item = await manager.findOne(PartMaster, { where: { itemCode: poItem.itemCode } });
    const unit = item.lotUnitQty ?? dto.receivedQty;  // NULL이면 단일 LOT
    const serialCount = Math.ceil(dto.receivedQty / unit);

    // 4. 채번 (Oracle SEQUENCE 일괄)
    const arrivalNo = await this.serialNo.nextArrivalNo(new Date(dto.receivedDate));
    const serials = await this.serialNo.nextMatSerialBatch(serialCount, new Date(dto.receivedDate));

    // 5. MAT_LOTS insert N건
    const lots: MatLot[] = [];
    let remaining = dto.receivedQty;
    for (let i = 0; i < serialCount; i++) {
      const qty = Math.min(unit, remaining);
      remaining -= qty;
      lots.push(manager.create(MatLot, {
        matUid: serials[i],
        itemCode: poItem.itemCode,
        initQty: qty,
        recvDate: new Date(dto.receivedDate),
        arrivalNo,
        arrivalSeq: i + 1,
        vendor: poItem.po.partnerCode,
        invoiceNo: '',  // 미사용
        poNo: poItem.po.poNo,
        mfgPartnerCode: dto.mfgPartnerCode,  // 신규
        iqcStatus: 'PENDING',
        status: 'NORMAL',
        company: user.company,
        plant: user.plant,
        createdBy: user.username,
      }));
    }
    await manager.save(lots);

    // 6. PO 라인 누적 입하 수량 갱신
    poItem.receivedQty += dto.receivedQty;
    if (poItem.receivedQty >= poItem.orderQty) poItem.status = 'CLOSE';
    await manager.save(poItem);

    // 7. MAT_STOCK, STOCK_TRANSACTION 갱신 (기존 로직 재사용)
    // ...

    return { arrivalNo, serials: lots };
  });
}
```

### 4-3. 컨트롤러 신규/변경

**파일:** `apps/backend/src/modules/material/controllers/arrival.controller.ts`

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET` | `/material/arrivals/po-lines?status=OPEN\|CLOSE&itemCode=&poNo=` | IQC005 메인 그리드용 PO 라인 목록 (라인 단위) |
| `POST` | `/material/arrivals/po-line` | 1라인 입하 등록 (위 메서드 호출) |
| `GET` | `/master/partners?type=MFG&useYn=Y` | 제조사 드롭다운 (기존 partner 컨트롤러 확장) |

기존 `/material/arrivals/receivable-pos`, `/material/arrivals/po/:id/items`는 **유지하되 deprecate 주석**. Phase B에서 정리.

### 4-4. 응답 형식

```ts
// GET /material/arrivals/po-lines
type PoLineRow = {
  poItemId: string;
  poNo: string;
  lineNo: number;          // L/N
  revNo: number;           // R/N
  itemCode: string;
  itemName: string;
  orderQty: number;
  receivedQty: number;
  remainingQty: number;
  orderDate: string;
  partnerName: string;     // 공급처
  useType: string;         // 사용구분 (양산/개발) - PO 메타 필드
  status: 'OPEN' | 'CLOSE';
};

// POST /material/arrivals/po-line 응답
type PoLineReceiptResponse = {
  arrivalNo: string;       // 'R26052600001'
  serials: Array<{
    matUid: string;        // 'VH1-RM260526-00001'
    initQty: number;
    arrivalSeq: number;
  }>;
};
```

## 5. 프론트 변경

### 5-1. 페이지 구조

**파일:** `apps/frontend/src/app/(authenticated)/material/arrival/page.tsx`

```
<div h-full flex flex-col p-6 gap-4>
  <Header />                                   // 자재 입하관리 + 새로고침
  <FilterCard />                               // 상태(OPEN/CLOSE) / 품번 / PO번호 / 조회 / 내보내기
  <PoLineGrid />                               // 메인 그리드 (flex-1, min-h-0)
  <PoLineReceiptModal />                       // 1라인 입하
  <SerialIssueConfirmModal />                  // n건 확인
  <MatLabelPreviewModal />                     // 라벨 미리보기
  <ManualArrivalModal />                       // 유지
</div>
```

### 5-2. 컴포넌트 변경

| 동작 | 파일 |
|---|---|
| ❌ 제거 | `components/PoArrivalModal.tsx` (Step1+Step2 모달) |
| ➡️ 이동 | `components/ArrivalHistoryTable.tsx` → Phase B에서 `/material/receive-history`로 |
| 🆕 신설 | `components/PoLineGrid.tsx`, `components/PoLineReceiptModal.tsx`, `components/SerialIssueConfirmModal.tsx`, `components/MatLabelPreviewModal.tsx` |
| 🆕 공통 | `apps/frontend/src/components/shared/MfgPartnerSelect.tsx` (partnerType=MFG) |
| ✅ 유지 | `ManualArrivalModal.tsx` (별도 워크플로) |

### 5-3. `PoLineGrid` 컬럼

| 컬럼 | 너비 | 비고 |
|---|---|---|
| [자재입하] | 110 | 잔량 0 / CLOSE는 disabled |
| PO번호 | 120 | font-bold |
| L/N | 50 | center |
| R/N | 50 | center |
| 품번 | 110 | font-bold |
| 품명 | flex | |
| 발주수량 | 90 | right |
| 누적입하 | 90 | right |
| 잔량 | 90 | right + `text-blue-700 font-bold` |
| 발주일 | 110 | center |
| 공급처 | 130 | |
| 사용 | 70 | `ComCodeBadge` (양산/개발) |
| 상태 | 80 | `ComCodeBadge` (OPEN/CLOSE) |

**행 배경 4단계:**
```ts
const rowClass = (row: PoLineRow) => {
  if (row.status === 'CLOSE') return 'bg-gray-100 text-gray-500';
  if (row.remainingQty === 0) return 'bg-blue-50/60';
  if (row.receivedQty > 0) return 'bg-yellow-50/60';
  return '';
};
```

DataGrid가 row 단위 className 미지원이면, `meta.rowClassName: (row) => string` 옵션 추가 필요. (기존 DataGrid 확장)

### 5-4. `PoLineReceiptModal` 필드

| 필드 | 컴포넌트 | 검증 |
|---|---|---|
| PO 정보 (read-only) | text | - |
| 입하/발주 / 잔량 | text | - |
| 입하수량 * | `Input` number | `1 <= v <= 잔량` |
| 입하일 * | `Input` date | `<= 오늘` |
| 제조사 * | `MfgPartnerSelect` | 필수 (빨강 테두리) |
| 시리얼수량단위 | text (disabled) | `LOT_UNIT_QTY`. NULL이면 "단일 LOT" |
| 예상 시리얼수 | 계산값 | `ceil(qty/unit)`, mvr 색상 |
| 비고 | `Textarea` | optional |

저장 흐름:
```
[저장 클릭]
  → 폼 검증
  → SerialIssueConfirmModal 오픈 ("n건 시리얼 발급합니다")
  → 확인
  → POST /material/arrivals/po-line
  → 응답 .serials로 MatLabelPreviewModal 오픈
  → 미리보기 + window.print()
  → 모달 닫기 + 그리드 새로고침
```

### 5-5. `MatLabelPreviewModal`

HTML 단순 미리보기. 시리얼당 라벨 1장 (격자 또는 페이지 break).
```html
<div class="label">
  <h2>VH1-RM260526-00001</h2>
  <p>TMN-0001 / Terminal TA</p>
  <p>입하: 2026-05-26 / 50 EA</p>
  <p>제조사: M001 한성정밀</p>
  <img src={barcode128(matUid)} />  <!-- 라이브러리: jsbarcode -->
</div>
```

`window.print()` 호출 + `@media print` CSS로 모달 외 영역 숨김.

## 6. i18n

ko/en/zh/vi 4파일에 키 추가:
- `material.arrival.iqc005Title` (이미 있을 수 있음 — 확인)
- `material.arrival.col.lineNo`, `revNo`, `useType`, `accReceived`
- `material.arrival.modal.serialQtyUnit`, `expectedSerialCount`, `mfgPartner`
- `material.arrival.confirm.serialIssue` ("{{count}}건의 시리얼을 발급합니다")
- `material.arrival.label.title` 등

BOM 절대 금지 ([[feedback_no_bom_in_json]]).

## 7. 검증 기준

| 항목 | 명령/방법 |
|---|---|
| 백엔드 빌드 | `pnpm --filter @hanes/backend build` 0 error |
| 프론트 빌드 | `pnpm --filter @hanes/frontend build` 0 error |
| 마이그레이션 적용 | `oracle-db`로 JSHANES에 4개 SQL 순차 실행, 컬럼/시퀀스/잡 존재 확인 |
| SEQUENCE 잡 ENABLED | `SELECT * FROM USER_SCHEDULER_JOBS WHERE JOB_NAME LIKE 'JOB_RESET_%_DAILY';` |
| 시드 | `PARTNER_MASTERS` PARTNER_TYPE='MFG' 5건, RM ITEM_MASTERS LOT_UNIT_QTY NOT NULL |
| UI 기능 검증 | PO 1라인 입하 200 / LOT_UNIT_QTY=50 → 시리얼 4건 발급 → 라벨 모달 → MAT_LOTS 4건 (모두 동일 ARRIVAL_NO) |

## 8. 리스크 & 결정 사항

| 리스크 | 영향 | 완화 |
|---|---|---|
| Oracle 버전이 12.2 미만이면 `ALTER SEQUENCE ... RESTART` 불가 | 일별 리셋 불가 | 배포 전 `SELECT * FROM V$VERSION` 확인. 11g면 DROP+CREATE 방식으로 fallback |
| `STOCK_TRANSACTION` 1건당 N개 LOT 처리 시 기존 컬럼 구조와 충돌 | 회계/감사 차이 | **시리얼(MAT_LOT)당 1건의 STOCK_TRANSACTION을 발생**시키고 (각 transNo 고유), `refType='ARRIVAL'`, `refId=arrivalNo`로 동일 입하건 그룹핑. 입하 1건 = N개 transaction이지만 동일 arrivalNo로 조회/취소 가능 |
| 자투리 LOT의 INIT_QTY가 단위와 다름 | IQC 검사 단위/샘플 수량 산정에 영향 | Phase A는 자투리 LOT도 동일 시리얼 형식. Phase B에서 PDF의 "자투리 별도 시리얼" 정책 추가 검토 |
| DataGrid가 row 단위 className 미지원 시 | 4단계 행 배경 구현 막힘 | DataGrid 확장 작업 별도 task. 또는 row 안의 첫 cell에 wrapper div 두는 방식으로 우회 |
| `MfgPartnerSelect`가 partners API 전체 페이징 시 느림 | UX | partnerType=MFG 필터링된 작은 목록이라 캐시(`useMasterOptions` 패턴) 적용 |

## 9. 변경 파일 목록

### 신규
- `apps/backend/src/migrations/2026-05-26_iqc005_mat_lots_mfg_code.sql`
- `apps/backend/src/migrations/2026-05-26_iqc005_serial_sequences.sql`
- `apps/backend/src/migrations/2026-05-26_iqc005_daily_reset_jobs.sql`
- `apps/backend/src/migrations/2026-05-26_iqc005_seed_mfg_partners.sql`
- `apps/backend/src/modules/material/services/mat-serial-number.service.ts`
- `apps/backend/src/modules/material/services/mat-serial-number.service.spec.ts`
- `apps/frontend/src/app/(authenticated)/material/arrival/components/PoLineGrid.tsx`
- `apps/frontend/src/app/(authenticated)/material/arrival/components/PoLineReceiptModal.tsx`
- `apps/frontend/src/app/(authenticated)/material/arrival/components/SerialIssueConfirmModal.tsx`
- `apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx`
- `apps/frontend/src/components/shared/MfgPartnerSelect.tsx`

### 변경
- `apps/backend/src/entities/mat-lot.entity.ts` — `mfgPartnerCode` 컬럼 추가
- `apps/backend/src/modules/material/services/arrival.service.ts` — `receivePoLine` 메서드
- `apps/backend/src/modules/material/controllers/arrival.controller.ts` — 2개 엔드포인트
- `apps/backend/src/modules/material/dto/arrival.dto.ts` — `PoLineReceiptDto`
- `apps/backend/src/modules/master/controllers/partner.controller.ts` — type 필터 (이미 있으면 skip)
- `apps/frontend/src/app/(authenticated)/material/arrival/page.tsx` — 전면 재작성
- `apps/frontend/src/app/(authenticated)/material/arrival/components/types.ts` — `PoLineRow`, `PoLineReceiptInput` 추가
- `apps/frontend/src/components/data-grid/DataGrid.tsx` — `meta.rowClassName` 옵션 (필요 시)
- `apps/frontend/src/locales/{ko,en,zh,vi}.json` — 신규 키

### 제거 (Phase A에서)
- `apps/frontend/src/app/(authenticated)/material/arrival/components/PoArrivalModal.tsx`

### 이동 (Phase B에서)
- `apps/frontend/src/app/(authenticated)/material/arrival/components/ArrivalHistoryTable.tsx` → `/material/receive-history/components/`
