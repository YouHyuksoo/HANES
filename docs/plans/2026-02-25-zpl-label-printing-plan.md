# ZPL 라벨 인쇄 시스템 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 외부 디자이너에서 만든 ZPL 템플릿을 등록하고 Zebra 프린터(USB/TCP)로 직접 출력하는 기능 추가

**Architecture:** 기존 LABEL_TEMPLATES 테이블에 ZPL 관련 컬럼 추가, Zebra Browser Print JS SDK로 USB 프린터 연동, 백엔드 net.Socket으로 TCP/IP 프린터 연동(옵션), 발행 이력을 LABEL_PRINT_LOGS 테이블에 저장

**Tech Stack:** NestJS + TypeORM (Oracle DB), Next.js 15, Zebra Browser Print SDK, bwip-js, Labelary API (ZPL 미리보기)

**참조 디자인 문서:** `docs/plans/2026-02-25-zpl-label-printing-design.md`

---

## Task 1: Oracle DB — LABEL_TEMPLATES 테이블 컬럼 추가

**oracle-db 스킬로 JSHANES 사이트에 실행**

```sql
-- LABEL_TEMPLATES 테이블에 ZPL 관련 컬럼 추가
ALTER TABLE LABEL_TEMPLATES ADD (
  ZPL_CODE CLOB DEFAULT NULL,
  PRINT_MODE VARCHAR2(20) DEFAULT 'BROWSER',
  PRINTER_ID RAW(16) DEFAULT NULL
);

COMMENT ON COLUMN LABEL_TEMPLATES.ZPL_CODE IS '외부 디자이너에서 만든 ZPL 코드 (변수 플레이스홀더 포함)';
COMMENT ON COLUMN LABEL_TEMPLATES.PRINT_MODE IS '인쇄 모드: BROWSER, ZPL, BOTH';
COMMENT ON COLUMN LABEL_TEMPLATES.PRINTER_ID IS '기본 프린터 ID (EQUIP_MASTERS FK, 옵션)';
```

---

## Task 2: Oracle DB — LABEL_PRINT_LOGS 테이블 생성

**oracle-db 스킬로 JSHANES 사이트에 실행**

```sql
CREATE TABLE LABEL_PRINT_LOGS (
  ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  TEMPLATE_ID RAW(16),
  CATEGORY VARCHAR2(20) NOT NULL,
  PRINT_MODE VARCHAR2(20) NOT NULL,
  PRINTER_NAME VARCHAR2(100),
  LOT_IDS CLOB,
  LABEL_COUNT NUMBER DEFAULT 0,
  WORKER_ID VARCHAR2(50),
  PRINTED_AT TIMESTAMP DEFAULT SYSTIMESTAMP,
  STATUS VARCHAR2(20) DEFAULT 'SUCCESS',
  ERROR_MSG VARCHAR2(500),
  COMPANY VARCHAR2(50),
  PLANT_CD VARCHAR2(50),
  CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP,
  UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE INDEX IDX_LABEL_PRINT_LOGS_CAT ON LABEL_PRINT_LOGS(CATEGORY);
CREATE INDEX IDX_LABEL_PRINT_LOGS_DATE ON LABEL_PRINT_LOGS(PRINTED_AT);
CREATE INDEX IDX_LABEL_PRINT_LOGS_STATUS ON LABEL_PRINT_LOGS(STATUS);

COMMENT ON TABLE LABEL_PRINT_LOGS IS '라벨 발행 이력';
COMMENT ON COLUMN LABEL_PRINT_LOGS.TEMPLATE_ID IS '사용된 라벨 템플릿 ID';
COMMENT ON COLUMN LABEL_PRINT_LOGS.CATEGORY IS '라벨 카테고리 (mat_lot 등)';
COMMENT ON COLUMN LABEL_PRINT_LOGS.PRINT_MODE IS '출력 방식: BROWSER, ZPL_USB, ZPL_TCP';
COMMENT ON COLUMN LABEL_PRINT_LOGS.PRINTER_NAME IS '출력된 프린터명';
COMMENT ON COLUMN LABEL_PRINT_LOGS.LOT_IDS IS '발행 대상 LOT ID 배열 (JSON)';
COMMENT ON COLUMN LABEL_PRINT_LOGS.LABEL_COUNT IS '출력 매수';
COMMENT ON COLUMN LABEL_PRINT_LOGS.WORKER_ID IS '발행자';
COMMENT ON COLUMN LABEL_PRINT_LOGS.STATUS IS '상태: SUCCESS, FAILED';
```

---

## Task 3: Oracle DB — PRINT_MODE ComCode 등록

**oracle-db 스킬로 JSHANES 사이트에 실행**

```sql
MERGE INTO COM_CODES t
USING (
  SELECT 'PRINT_MODE' AS GROUP_CODE, 'BROWSER'  AS CODE_VALUE, '브라우저 인쇄' AS CODE_NAME, 'Browser Print' AS CODE_NAME_EN, 1 AS SORT_ORDER, '#3B82F6' AS ATTR1 FROM DUAL UNION ALL
  SELECT 'PRINT_MODE', 'ZPL',      'ZPL 인쇄',      'ZPL Print',      2, '#10B981' FROM DUAL UNION ALL
  SELECT 'PRINT_MODE', 'BOTH',     '병행(브라우저+ZPL)', 'Both',        3, '#8B5CF6' FROM DUAL
) s ON (t.GROUP_CODE = s.GROUP_CODE AND t.CODE_VALUE = s.CODE_VALUE)
WHEN NOT MATCHED THEN
  INSERT (ID, GROUP_CODE, CODE_VALUE, CODE_NAME, CODE_NAME_EN, SORT_ORDER, ATTR1, USE_YN, CREATED_AT, UPDATED_AT)
  VALUES (SYS_GUID(), s.GROUP_CODE, s.CODE_VALUE, s.CODE_NAME, s.CODE_NAME_EN, s.SORT_ORDER, s.ATTR1, 'Y', SYSDATE, SYSDATE);
COMMIT;
```

---

## Task 4: 백엔드 — LabelTemplate 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/label-template.entity.ts`

`LabelTemplate` 엔티티에 3개 컬럼 추가:

```typescript
// 기존 remark 컬럼 뒤에 추가

@Column({ name: 'ZPL_CODE', type: 'clob', nullable: true })
zplCode: string | null;

@Column({ name: 'PRINT_MODE', length: 20, default: 'BROWSER' })
printMode: string;

@Column({ name: 'PRINTER_ID', type: 'raw', length: 16, nullable: true })
printerId: string | null;
```

---

## Task 5: 백엔드 — LabelPrintLog 엔티티 생성

**Files:**
- Create: `apps/backend/src/entities/label-print-log.entity.ts`

```typescript
/**
 * @file entities/label-print-log.entity.ts
 * @description 라벨 발행 이력 엔티티 (LABEL_PRINT_LOGS 테이블)
 *
 * 초보자 가이드:
 * - 라벨을 발행할 때마다 이력을 저장하는 테이블
 * - 누가, 언제, 몇 장을, 어떤 프린터로 발행했는지 추적
 * - STATUS: SUCCESS(성공), FAILED(실패)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'LABEL_PRINT_LOGS' })
@Index(['category'])
@Index(['printedAt'])
@Index(['status'])
export class LabelPrintLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'TEMPLATE_ID', type: 'raw', length: 16, nullable: true })
  templateId: string | null;

  @Column({ name: 'CATEGORY', length: 20 })
  category: string;

  @Column({ name: 'PRINT_MODE', length: 20 })
  printMode: string;

  @Column({ name: 'PRINTER_NAME', length: 100, nullable: true })
  printerName: string | null;

  @Column({ name: 'LOT_IDS', type: 'clob', nullable: true })
  lotIds: string | null;

  @Column({ name: 'LABEL_COUNT', type: 'number', default: 0 })
  labelCount: number;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'PRINTED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  printedAt: Date;

  @Column({ name: 'STATUS', length: 20, default: 'SUCCESS' })
  status: string;

  @Column({ name: 'ERROR_MSG', length: 500, nullable: true })
  errorMsg: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

**엔티티를 material 모듈에 등록:**
- Modify: `apps/backend/src/modules/material/material.module.ts` — TypeOrmModule.forFeature에 `LabelPrintLog` 추가

---

## Task 6: 백엔드 — LabelTemplate DTO 수정

**Files:**
- Modify: `apps/backend/src/modules/master/dto/label-template.dto.ts`

`CreateLabelTemplateDto`에 추가:

```typescript
@ApiPropertyOptional({ description: 'ZPL 코드 (외부 디자이너에서 만든 코드)' })
@IsOptional()
@IsString()
zplCode?: string;

@ApiPropertyOptional({ description: '인쇄 모드', enum: ['BROWSER', 'ZPL', 'BOTH'], default: 'BROWSER' })
@IsOptional()
@IsString()
@IsIn(['BROWSER', 'ZPL', 'BOTH'])
printMode?: string;

@ApiPropertyOptional({ description: '기본 프린터 ID' })
@IsOptional()
@IsString()
printerId?: string;
```

`LabelTemplateService.create()`, `update()`에서 `zplCode`, `printMode`, `printerId` 처리 추가.

---

## Task 7: 백엔드 — LabelPrint DTO 생성

**Files:**
- Create: `apps/backend/src/modules/material/dto/label-print.dto.ts`

```typescript
/**
 * @file dto/label-print.dto.ts
 * @description 라벨 인쇄 관련 DTO
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsArray, IsInt, IsIn, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** ZPL 생성 요청 (변수 치환) */
export class GenerateZplDto {
  @ApiProperty({ description: '템플릿 ID' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'LOT ID 배열', type: [String] })
  @IsArray()
  @IsString({ each: true })
  lotIds: string[];
}

/** TCP/IP 프린터 전송 요청 */
export class TcpPrintDto {
  @ApiProperty({ description: '프린터 IP 주소' })
  @IsString()
  printerIp: string;

  @ApiProperty({ description: '프린터 포트', default: 9100 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ description: '전송할 ZPL 데이터' })
  @IsString()
  zplData: string;
}

/** 발행 이력 저장 */
export class CreatePrintLogDto {
  @ApiPropertyOptional({ description: '템플릿 ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ description: '카테고리', default: 'mat_lot' })
  @IsString()
  category: string;

  @ApiProperty({ description: '출력 방식', enum: ['BROWSER', 'ZPL_USB', 'ZPL_TCP'] })
  @IsString()
  @IsIn(['BROWSER', 'ZPL_USB', 'ZPL_TCP'])
  printMode: string;

  @ApiPropertyOptional({ description: '프린터명' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  printerName?: string;

  @ApiProperty({ description: 'LOT ID 배열', type: [String] })
  @IsArray()
  @IsString({ each: true })
  lotIds: string[];

  @ApiProperty({ description: '출력 매수' })
  @IsInt()
  @Min(1)
  labelCount: number;

  @ApiPropertyOptional({ description: '상태', enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' })
  @IsOptional()
  @IsString()
  @IsIn(['SUCCESS', 'FAILED'])
  status?: string;

  @ApiPropertyOptional({ description: '에러 메시지' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMsg?: string;
}

/** 발행 이력 조회 */
export class PrintLogQueryDto {
  @ApiPropertyOptional({ description: '카테고리' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '출력 방식' })
  @IsOptional()
  @IsString()
  printMode?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}
```

---

## Task 8: 백엔드 — LabelPrint 서비스 생성

**Files:**
- Create: `apps/backend/src/modules/material/services/label-print.service.ts`

**핵심 메서드:**

1. `generateZpl(dto)`: 템플릿의 ZPL 코드에서 변수 치환 → LOT별 ZPL 문자열 반환
   - `{{lotNo}}` → lot.lotNo, `{{partCode}}` → lot.part.partCode 등
   - LOT 조회: `matLotRepository.findOne()` + `partMasterRepository.findOne()`
   - 각 LOT별 initQty 만큼 반복

2. `printViaTcp(dto)`: `net.Socket`으로 TCP/IP 프린터에 ZPL 전송 (옵션)

3. `createLog(dto, company, plant)`: LABEL_PRINT_LOGS에 이력 저장

4. `findLogs(query, company, plant)`: 이력 조회 (페이지네이션 + 필터)

**의존성:**
- `@InjectRepository(LabelPrintLog)`
- `@InjectRepository(LabelTemplate)`
- `@InjectRepository(MatLot)`
- `@InjectRepository(PartMaster)`

---

## Task 9: 백엔드 — LabelPrint 컨트롤러 생성

**Files:**
- Create: `apps/backend/src/modules/material/controllers/label-print.controller.ts`

**엔드포인트:**

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/material/label-print/generate` | ZPL 변수 치환 결과 반환 |
| POST | `/material/label-print/tcp` | TCP/IP로 프린터 전송 (옵션) |
| POST | `/material/label-print/log` | 발행 이력 저장 |
| GET | `/material/label-print/logs` | 발행 이력 조회 |

**material.module.ts에 등록:**
- `LabelPrintService`를 providers에 추가
- `LabelPrintController`를 controllers에 추가

---

## Task 10: 프론트엔드 — Zebra Browser Print 연동 Hook

**Files:**
- Create: `apps/frontend/src/hooks/useZebraPrinter.ts`

**Zebra Browser Print SDK:**
- Zebra Browser Print는 로컬 에이전트 (포트 9100 or WebSocket `wss://localhost:9101`)
- JS API: `BrowserPrint.getDefaultDevice()`, `device.send(zplData)`
- 에이전트 미설치 시 graceful fallback

**Hook 인터페이스:**

```typescript
interface UseZebraPrinterReturn {
  isAgentAvailable: boolean;   // 에이전트 연결 여부
  printers: ZebraPrinter[];    // 감지된 프린터 목록
  selectedPrinter: ZebraPrinter | null;
  setSelectedPrinter: (printer: ZebraPrinter | null) => void;
  sendZpl: (zplData: string) => Promise<boolean>;  // ZPL 전송
  checkStatus: () => Promise<void>;                 // 상태 재확인
  error: string | null;
}

interface ZebraPrinter {
  name: string;
  uid: string;
  connection: string;  // 'usb' | 'network'
  deviceType: string;
}
```

**구현:**
1. `useEffect`에서 에이전트 연결 확인 (`fetch('http://localhost:9100/available')`)
2. 프린터 목록 조회 (`fetch('http://localhost:9100/default?type=printer')`)
3. `sendZpl()`: 선택된 프린터에 ZPL 전송
4. 에이전트 미설치 시 `isAgentAvailable = false` + 안내 메시지

---

## Task 11: 프론트엔드 — ZPL 에디터 컴포넌트

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/label/components/ZplEditor.tsx`

**UI 구성:**
1. **인쇄 모드 선택**: Select (BROWSER / ZPL / BOTH) — ComCodeBadge 활용
2. **ZPL 코드 에디터**: 큰 textarea (모노스페이스 폰트, 줄번호 표시)
3. **변수 도우미**: 사용 가능한 플레이스홀더 버튼 목록 → 클릭 시 커서 위치에 삽입
   - `{{lotNo}}`, `{{partCode}}`, `{{partName}}`, `{{qty}}`, `{{unit}}`, `{{vendor}}`, `{{recvDate}}`, `{{barcode}}`, `{{custom1~5}}`
4. **ZPL 미리보기**: Labelary API로 ZPL → 이미지 변환 (버튼 클릭 시)
   - `POST http://api.labelary.com/v1/printers/8dpmm/labels/2.83x1.97/0/` + ZPL body → PNG 응답

**Props:**
```typescript
interface ZplEditorProps {
  zplCode: string;
  onZplCodeChange: (code: string) => void;
  printMode: string;
  onPrintModeChange: (mode: string) => void;
  category: LabelCategory;
}
```

**라벨 관리 페이지 통합:**
- Modify: `apps/frontend/src/app/(authenticated)/master/label/page.tsx`
- 기존 LabelDesigner 옆에 "ZPL 코드" 탭 추가
- 템플릿 저장 시 `zplCode`, `printMode` 함께 저장

---

## Task 12: 프론트엔드 — 입고 라벨 발행 페이지 수정

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/material/receive-label/page.tsx`

**변경사항:**

1. **출력 방식 드롭다운** 추가 (라벨 발행 버튼 옆):
   - `브라우저 인쇄` (기존), `ZPL - USB`, `ZPL - 네트워크`(옵션)
   - 템플릿의 printMode에 따라 사용 가능 옵션 필터링

2. **ZPL 출력 흐름:**
   - LOT 선택 → "라벨 발행" 클릭
   - `POST /material/label-print/generate` 호출 → 치환된 ZPL 수신
   - printMode === 'ZPL_USB': `useZebraPrinter.sendZpl(zplData)` 호출
   - printMode === 'ZPL_TCP': `POST /material/label-print/tcp` 호출
   - 성공/실패 시 `POST /material/label-print/log` 호출 (이력 저장)

3. **프린터 상태 표시:**
   - Zebra Browser Print 에이전트 연결 상태 배지
   - 프린터 선택 드롭다운 (감지된 프린터 목록)

4. **기존 브라우저 인쇄:** 그대로 유지, 발행 이력 저장 추가

---

## Task 13: 프론트엔드 — 발행 이력 섹션

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/material/receive-label/components/PrintHistorySection.tsx`

**UI:**
- 입고 라벨 발행 페이지 하단에 "발행 이력" 접이식 섹션
- DataGrid: 발행일시, 출력방식(ComCodeBadge), 매수, 프린터명, 상태, 발행자
- 필터: 기간 (오늘/7일/30일), 출력방식 드롭다운

**API 호출:**
- `GET /material/label-print/logs?category=mat_lot&dateFrom=...&dateTo=...`

---

## Task 14: i18n — 4개 locale 파일 업데이트

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

**추가 키 (중첩 material 객체 내):**

```json
{
  "label": {
    "zplCode": "ZPL 코드",
    "zplCodePlaceholder": "외부 디자이너에서 만든 ZPL 코드를 붙여넣으세요...",
    "printMode": "인쇄 모드",
    "variableHelper": "변수 도우미",
    "insertVariable": "변수 삽입",
    "zplPreview": "ZPL 미리보기",
    "zplPreviewLoading": "미리보기 생성 중...",
    "print": {
      "browserPrint": "브라우저 인쇄",
      "zplUsb": "ZPL - USB 프린터",
      "zplTcp": "ZPL - 네트워크",
      "selectMethod": "출력 방식 선택",
      "selectPrinter": "프린터 선택",
      "agentConnected": "Zebra 에이전트 연결됨",
      "agentDisconnected": "Zebra 에이전트 미연결",
      "agentInstallGuide": "Zebra Browser Print를 설치해주세요",
      "noPrinterFound": "감지된 프린터가 없습니다",
      "sending": "전송 중...",
      "success": "라벨 출력 완료",
      "failed": "라벨 출력 실패",
      "history": "발행 이력",
      "printedAt": "발행일시",
      "printerName": "프린터명",
      "labelCount": "매수",
      "printedBy": "발행자"
    }
  }
}
```

4개 언어 모두 동일 키 구조로 번역.

---

## Task 순서 의존성

```
Task 1~3 (Oracle DB) → Task 4~5 (Entity) → Task 6~7 (DTO) → Task 8~9 (Service/Controller)
                                                                    ↓
Task 10 (useZebraPrinter Hook) → Task 11 (ZPL Editor) → Task 12 (발행 페이지) → Task 13 (이력)
                                                                    ↓
                                                              Task 14 (i18n)
```

- Task 1~3: DB 작업 (oracle-db 스킬)
- Task 4~9: 백엔드 (순차)
- Task 10~13: 프론트엔드 (순차, Task 8~9 이후)
- Task 14: i18n (Task 12 이후)
