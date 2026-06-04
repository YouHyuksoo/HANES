# BOM 엑셀 업로드 버튼 + 폼 템플릿 다운로드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BOM 관리 페이지 헤더에 "엑셀 업로드" 버튼(기존 BomUploadModal 연결)과 "폼 다운로드" 버튼(헤더만 있는 빈 xlsx 템플릿 다운로드)을 추가한다.

**Architecture:** 백엔드에 `GET /master/boms/template` 엔드포인트를 신규 추가해 빈 xlsx 파일을 반환한다. 프론트엔드 `page.tsx`에서 두 버튼을 헤더 우측에 배치하고, 업로드 버튼은 이미 구현된 `BomUploadModal`을 열도록 연결한다.

**Tech Stack:** NestJS (백엔드), xlsx(exceljs 아님), Next.js 14 (프론트엔드), react-i18next (i18n)

---

## File Map

| 역할 | 파일 |
|------|------|
| 수정 | `apps/backend/src/modules/master/services/bom.service.ts` |
| 수정 | `apps/backend/src/modules/master/controllers/bom.controller.ts` |
| 수정 | `apps/frontend/src/app/(authenticated)/master/bom/page.tsx` |
| 수정 | `apps/frontend/src/locales/ko.json` |
| 수정 | `apps/frontend/src/locales/en.json` |
| 수정 | `apps/frontend/src/locales/zh.json` |
| 수정 | `apps/frontend/src/locales/vi.json` |

---

### Task 1: bom.service.ts — downloadTemplate 메서드 추가

**Files:**
- Modify: `apps/backend/src/modules/master/services/bom.service.ts`

- [ ] **Step 1: `exportToExcel` 메서드 바로 아래에 `downloadTemplate` 추가**

파일에서 `exportToExcel` 메서드 끝(line ~508) 다음에 아래 코드를 삽입한다.

```typescript
  /** 업로드 양식용 빈 xlsx 템플릿 반환 (헤더 행만 포함) */
  downloadTemplate(): Buffer {
    const headers = ['상위품목코드', '하위품목코드', '소요량', '리비전', '순서', 'BOM그룹', '공정코드', '사이드', 'ECO번호', '유효시작일', '유효종료일', '비고'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
```

- [ ] **Step 2: 빌드 오류 없음 확인**

```bash
cd C:/Project/HANES
pnpm --filter backend build 2>&1 | tail -20
```

Expected: 에러 없이 빌드 성공

---

### Task 2: bom.controller.ts — GET /master/boms/template 엔드포인트 추가

**Files:**
- Modify: `apps/backend/src/modules/master/controllers/bom.controller.ts`

- [ ] **Step 1: `export` 엔드포인트 바로 다음에 `template` 엔드포인트 추가**

`@Get('export')` 라우트 블록(line ~48~69) 바로 다음에 아래 코드를 삽입한다.

```typescript
  @Get('template')
  @ApiOperation({ summary: 'Download blank BOM Excel template' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.bomService.downloadTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="BOM_template.xlsx"',
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
```

- [ ] **Step 2: 백엔드 빌드 확인**

```bash
cd C:/Project/HANES
pnpm --filter backend build 2>&1 | tail -20
```

Expected: 에러 없이 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/modules/master/services/bom.service.ts apps/backend/src/modules/master/controllers/bom.controller.ts
git commit -m "feat(bom): BOM 엑셀 폼 템플릿 다운로드 API 추가 (GET /master/boms/template)"
```

---

### Task 3: i18n 4파일 — 번역 키 추가

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

각 파일의 `"master"."bom"` 섹션 마지막 키(`"childItem": "??"`) 바로 앞에 두 키를 추가한다.

- [ ] **Step 1: ko.json 수정**

`"childItem": "??"` 앞에 추가:
```json
      "excelUpload": "엑셀 업로드",
      "downloadTemplate": "폼 다운로드",
```

- [ ] **Step 2: en.json 수정**

동일 위치에 추가:
```json
      "excelUpload": "Excel Upload",
      "downloadTemplate": "Download Template",
```

- [ ] **Step 3: zh.json 수정**

동일 위치에 추가:
```json
      "excelUpload": "Excel上传",
      "downloadTemplate": "下载模板",
```

- [ ] **Step 4: vi.json 수정**

동일 위치에 추가:
```json
      "excelUpload": "Tải lên Excel",
      "downloadTemplate": "Tải mẫu",
```

- [ ] **Step 5: 4파일 모두 키 존재 확인**

```bash
grep -n "downloadTemplate" apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
```

Expected: 4개 파일 모두 한 줄씩 출력

- [ ] **Step 6: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "feat(bom): i18n — 엑셀 업로드/폼 다운로드 번역 키 추가 (ko/en/zh/vi)"
```

---

### Task 4: page.tsx — 버튼 추가 및 BomUploadModal 연결

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/bom/page.tsx`

- [ ] **Step 1: import 추가**

파일 상단 import 목록에서 `lucide-react`의 아이콘 목록과 컴포넌트 import를 수정한다.

기존:
```tsx
import { Calendar, GitBranch, Layers, RefreshCw, Search, X } from "lucide-react";
```
변경 후:
```tsx
import { Calendar, Download, FileSpreadsheet, GitBranch, Layers, RefreshCw, Search, X } from "lucide-react";
```

그리고 BomTab import 바로 아래에 추가:
```tsx
import BomUploadModal from "./components/BomUploadModal";
```

- [ ] **Step 2: 업로드 모달 상태 추가**

`BomPage` 함수 내 `useState` 선언부(line ~36 근처)에 추가:
```tsx
const [uploadOpen, setUploadOpen] = useState(false);
```

- [ ] **Step 3: 헤더 버튼 영역에 두 버튼 추가**

기존 헤더 우측 버튼 영역:
```tsx
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5">
            ...날짜 입력...
          </div>
          <Button variant="secondary" size="sm" onClick={fetchParents}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingParents ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
```

변경 후 (새 버튼 두 개를 날짜 입력 앞에 추가):
```tsx
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const a = document.createElement("a");
              a.href = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/master/boms/template`;
              a.download = "BOM_template.xlsx";
              a.click();
            }}
          >
            <Download className="w-4 h-4 mr-1" />
            {t("master.bom.downloadTemplate")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            {t("master.bom.excelUpload")}
          </Button>
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm text-text-muted whitespace-nowrap">{t("master.bom.effectiveDate")}:</span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="bg-transparent text-sm text-text font-medium border-none outline-none cursor-pointer"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchParents}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingParents ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
```

- [ ] **Step 4: return JSX 맨 끝(닫는 `</div>` 직전)에 모달 마운트**

기존 return 마지막 부분:
```tsx
    </div>
  );
}
```

변경 후:
```tsx
      <BomUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={() => { setUploadOpen(false); fetchParents(); }}
      />
    </div>
  );
}
```

- [ ] **Step 5: 프론트엔드 빌드 오류 없음 확인**

```bash
cd C:/Project/HANES
pnpm --filter frontend build 2>&1 | tail -30
```

Expected: 에러 없이 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/master/bom/page.tsx
git commit -m "feat(bom): BOM 페이지에 엑셀 업로드 버튼 및 폼 다운로드 버튼 추가"
```

---

## 완료 체크리스트

- [ ] `GET /master/boms/template` → 헤더만 있는 xlsx 반환
- [ ] "폼 다운로드" 버튼 클릭 → `BOM_template.xlsx` 다운로드
- [ ] "엑셀 업로드" 버튼 클릭 → `BomUploadModal` 열림
- [ ] 업로드 완료 후 목록 자동 새로고침
- [ ] ko/en/zh/vi 4개 locale 키 존재
- [ ] `pnpm build` 에러 없음
