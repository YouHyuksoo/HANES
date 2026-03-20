# BOM 엑셀 업로드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BOM 데이터를 엑셀로 내보내기/업로드하여 신규 항목만 추가하는 기능 구현

**Architecture:** 백엔드에 xlsx 패키지 추가, BomService에 export/upload 메서드 추가, BomController에 엔드포인트 추가. 프론트엔드 BOM 페이지에 내보내기/업로드 버튼 추가. 업로드 시 기존 PK 존재하면 스킵, 신규만 INSERT.

**Tech Stack:** xlsx (백엔드), Multer (파일 업로드), 기존 xlsx (프론트엔드 내보내기)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `apps/backend/src/modules/master/services/bom.service.ts` | exportToExcel, uploadFromExcel 메서드 추가 |
| Modify | `apps/backend/src/modules/master/controllers/bom.controller.ts` | GET export, POST upload 엔드포인트 추가 |
| Modify | `apps/frontend/src/app/(authenticated)/master/bom/components/BomTab.tsx` | 내보내기/업로드 버튼 + 결과 모달 |
| Create | `apps/frontend/src/app/(authenticated)/master/bom/components/BomUploadModal.tsx` | 업로드 모달 UI |

---

### Task 1: 백엔드 xlsx 패키지 설치

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: xlsx 설치**

```bash
pnpm add --filter @harness/backend xlsx
```

- [ ] **Step 2: 설치 확인**

Run: `pnpm ls xlsx --filter @harness/backend`

---

### Task 2: BomService에 export/upload 메서드 추가

**Files:**
- Modify: `apps/backend/src/modules/master/services/bom.service.ts`

- [ ] **Step 1: exportToExcel 메서드 추가**

BomService에 다음 메서드 추가:

```typescript
/**
 * 특정 모품목의 BOM을 엑셀 Buffer로 내보내기
 * @param parentItemCode 모품목 코드 (없으면 전체)
 * @param company 회사코드
 * @param plant 사업장코드
 * @returns xlsx Buffer
 */
async exportToExcel(parentItemCode?: string, company?: string, plant?: string): Promise<Buffer> {
  // 1. BOM 데이터 조회
  const where: any = { useYn: 'Y' };
  if (parentItemCode) where.parentItemCode = parentItemCode;
  if (company) where.company = company;
  if (plant) where.plantCd = plant;

  const boms = await this.bomRepository.find({
    where,
    order: { parentItemCode: 'ASC', seq: 'ASC' },
  });

  // 2. 엑셀 데이터 구성
  const rows = boms.map((b) => ({
    '상위품목코드': b.parentItemCode,
    '하위품목코드': b.childItemCode,
    '소요량': b.qtyPer,
    '리비전': b.revision,
    '순서': b.seq,
    'BOM그룹': b.bomGrp ?? '',
    '공정코드': b.processCode ?? '',
    '사이드': b.side ?? '',
    'ECO번호': b.ecoNo ?? '',
    '유효시작일': b.validFrom ? new Date(b.validFrom).toISOString().split('T')[0] : '',
    '유효종료일': b.validTo ? new Date(b.validTo).toISOString().split('T')[0] : '',
    '비고': b.remark ?? '',
  }));

  // 빈 행 추가 (신규 입력용)
  if (rows.length === 0) {
    rows.push({
      '상위품목코드': '', '하위품목코드': '', '소요량': 0,
      '리비전': 'A', '순서': 0, 'BOM그룹': '', '공정코드': '',
      '사이드': '', 'ECO번호': '', '유효시작일': '', '유효종료일': '', '비고': '',
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 6 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOM');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
```

- [ ] **Step 2: uploadFromExcel 메서드 추가**

```typescript
/** 엑셀 업로드 결과 */
interface BomUploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/**
 * 엑셀 파일에서 BOM 데이터를 읽어 신규 항목만 INSERT
 * @param buffer 엑셀 파일 Buffer
 * @param company 회사코드
 * @param plant 사업장코드
 * @param userId 등록자
 * @returns 업로드 결과 (inserted, skipped, errors)
 */
async uploadFromExcel(
  buffer: Buffer,
  company: string,
  plant: string,
  userId: string,
): Promise<BomUploadResult> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

  const result: BomUploadResult = { inserted: 0, skipped: 0, errors: [] };

  // 1. 전체 품목코드 유효성 한 번에 검증
  const allCodes = new Set<string>();
  for (const row of rows) {
    if (row['상위품목코드']) allCodes.add(String(row['상위품목코드']).trim());
    if (row['하위품목코드']) allCodes.add(String(row['하위품목코드']).trim());
  }
  const existingParts = await this.partRepository.find({
    where: { itemCode: In([...allCodes]) },
    select: ['itemCode'],
  });
  const validCodes = new Set(existingParts.map((p) => p.itemCode));

  // 2. 기존 BOM PK 한 번에 조회 (중복 체크)
  const parentCodes = [...new Set(rows.map((r) => String(r['상위품목코드'] ?? '').trim()).filter(Boolean))];
  const existingBoms = parentCodes.length > 0
    ? await this.bomRepository.find({
        where: { parentItemCode: In(parentCodes) },
        select: ['parentItemCode', 'childItemCode', 'revision'],
      })
    : [];
  const bomKeySet = new Set(existingBoms.map((b) => `${b.parentItemCode}::${b.childItemCode}::${b.revision}`));

  // 3. 행별 처리
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 엑셀 행 번호 (헤더=1)

    const parentCode = String(row['상위품목코드'] ?? '').trim();
    const childCode = String(row['하위품목코드'] ?? '').trim();
    const qtyPer = Number(row['소요량']);
    const revision = String(row['리비전'] ?? 'A').trim() || 'A';

    // 필수값 체크
    if (!parentCode || !childCode) {
      result.errors.push({ row: rowNum, message: '상위/하위 품목코드 필수' });
      continue;
    }
    if (isNaN(qtyPer) || qtyPer < 0) {
      result.errors.push({ row: rowNum, message: `소요량 오류: ${row['소요량']}` });
      continue;
    }
    if (parentCode === childCode) {
      result.errors.push({ row: rowNum, message: '상위/하위 품목코드가 동일' });
      continue;
    }

    // 품목코드 유효성
    if (!validCodes.has(parentCode)) {
      result.errors.push({ row: rowNum, message: `상위품목 미존재: ${parentCode}` });
      continue;
    }
    if (!validCodes.has(childCode)) {
      result.errors.push({ row: rowNum, message: `하위품목 미존재: ${childCode}` });
      continue;
    }

    // 중복 체크 (기존 PK)
    const key = `${parentCode}::${childCode}::${revision}`;
    if (bomKeySet.has(key)) {
      result.skipped++;
      continue;
    }

    // INSERT
    try {
      const bom = this.bomRepository.create({
        parentItemCode: parentCode,
        childItemCode: childCode,
        qtyPer,
        seq: Number(row['순서']) || 0,
        revision,
        bomGrp: String(row['BOM그룹'] ?? '').trim() || null,
        processCode: String(row['공정코드'] ?? '').trim() || null,
        side: String(row['사이드'] ?? '').trim() || null,
        ecoNo: String(row['ECO번호'] ?? '').trim() || null,
        validFrom: row['유효시작일'] ? new Date(String(row['유효시작일'])) : null,
        validTo: row['유효종료일'] ? new Date(String(row['유효종료일'])) : null,
        remark: String(row['비고'] ?? '').trim() || null,
        useYn: 'Y',
        company,
        plantCd: plant,
        createdBy: userId,
        updatedBy: userId,
      });
      await this.bomRepository.save(bom);
      bomKeySet.add(key); // 같은 파일 내 중복 방지
      result.inserted++;
    } catch (error: unknown) {
      result.errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
```

- [ ] **Step 3: import 추가**

파일 상단에 추가:
```typescript
import * as XLSX from 'xlsx';
```

---

### Task 3: BomController에 export/upload 엔드포인트 추가

**Files:**
- Modify: `apps/backend/src/modules/master/controllers/bom.controller.ts`

- [ ] **Step 1: export 엔드포인트 추가**

`findParents` 메서드 아래에 추가:

```typescript
@Get('export')
@ApiOperation({ summary: 'BOM 엑셀 내보내기' })
@ApiQuery({ name: 'parentItemCode', required: false })
async exportExcel(
  @Query('parentItemCode') parentItemCode?: string,
  @Company() company?: string,
  @Plant() plant?: string,
  @Res() res?: Response,
) {
  const buffer = await this.bomService.exportToExcel(parentItemCode, company, plant);
  const fileName = parentItemCode
    ? `BOM_${parentItemCode}_${new Date().toISOString().split('T')[0]}.xlsx`
    : `BOM_ALL_${new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.send(buffer);
}
```

- [ ] **Step 2: upload 엔드포인트 추가**

```typescript
@Post('upload')
@HttpCode(HttpStatus.OK)
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, callback: any) => {
    if (!file.originalname.match(/\.xlsx$/i)) {
      return callback(new BadRequestException('.xlsx 파일만 업로드 가능합니다.'), false);
    }
    callback(null, true);
  },
}))
@ApiOperation({ summary: 'BOM 엑셀 업로드 (신규만 추가)' })
@ApiConsumes('multipart/form-data')
async uploadExcel(
  @UploadedFile() file: Express.Multer.File,
  @Company() company: string,
  @Plant() plant: string,
  @Req() req: AuthenticatedRequest,
) {
  if (!file) throw new BadRequestException('파일이 없습니다.');
  const result = await this.bomService.uploadFromExcel(
    file.buffer, company, plant, req.user.id,
  );
  return ResponseUtil.success(result, `${result.inserted}건 추가, ${result.skipped}건 스킵`);
}
```

- [ ] **Step 3: import 추가**

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, Res, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
```

- [ ] **Step 4: Multer memoryStorage 설정**

FileInterceptor에 `storage: memoryStorage()` 추가하여 파일을 메모리에 버퍼로 받기:

```typescript
import { memoryStorage } from 'multer';

// FileInterceptor 옵션에 추가
FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  ...
})
```

**주의**: export 엔드포인트는 `@Get('export')`이므로 `@Get('parents')` 아래, `@Get('hierarchy/:parentItemCode')` 위에 배치해야 라우트 충돌 방지

---

### Task 4: 프론트엔드 업로드 모달 컴포넌트

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/bom/components/BomUploadModal.tsx`

- [ ] **Step 1: BomUploadModal 컴포넌트 작성**

```typescript
/**
 * @file BomUploadModal.tsx
 * @description BOM 엑셀 업로드 모달 - 파일 선택 → 업로드 → 결과 표시
 *
 * 초보자 가이드:
 * 1. 파일 선택 (드래그앤드롭 또는 클릭)
 * 2. 업로드 버튼 클릭 → POST /master/boms/upload
 * 3. 결과 표시: 추가/스킵/에러 건수
 */
```

주요 기능:
- Modal (lg 사이즈)
- 파일 input (.xlsx만)
- 업로드 진행 상태 (loading)
- 결과 표시: inserted, skipped, errors 테이블
- 완료 시 부모 컴포넌트에 onComplete 콜백

---

### Task 5: BomTab에 내보내기/업로드 버튼 추가

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/bom/components/BomTab.tsx`

- [ ] **Step 1: 버튼 2개 추가**

BomTab 상단 액션 영역에:
- **내보내기** 버튼: `GET /master/boms/export?parentItemCode=XXX` → 엑셀 다운로드
- **엑셀 업로드** 버튼: BomUploadModal 열기

- [ ] **Step 2: 내보내기 핸들러**

```typescript
const handleExport = async () => {
  const params = new URLSearchParams();
  if (parentItemCode) params.set('parentItemCode', parentItemCode);
  const res = await api.get(`/master/boms/export?${params}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BOM_${parentItemCode || 'ALL'}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 3: 업로드 완료 시 트리 새로고침**

BomUploadModal의 `onComplete` 콜백에서 `fetchTree()` 호출

---

### Task 6: 최종 빌드 검증

- [ ] **Step 1: 전체 빌드**

Run: `pnpm build`
Expected: 에러 0건 (기존 rework 에러 제외)

- [ ] **Step 2: BOM 업로드 E2E 테스트**

1. 브라우저에서 BOM 페이지 접속
2. "내보내기" 클릭 → 엑셀 다운로드 확인
3. 엑셀에 신규 행 추가
4. "엑셀 업로드" → 결과 확인 (inserted > 0)
5. 동일 파일 재업로드 → skipped = 전체
