/**
 * @file src/hooks/useExport.ts
 * @description 다중 포맷(Excel, PDF, CSV, HTML, Markdown, TXT) 데이터 내보내기 훅
 *
 * 초보자 가이드:
 * 1. DataGrid 컴포넌트 내부에서 자동으로 사용됨
 * 2. enableExport prop을 DataGrid에 추가하면 Export 드롭다운이 표시됨
 * 3. TanStack Table의 columns에서 accessorKey/header를 자동 추출하여 내보내기
 * 4. 지원 포맷: Excel(.xlsx), PDF(.pdf), CSV(.csv), HTML(.html), Markdown(.md), TXT(.txt)
 */
import { useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";

/** 내보내기 포맷 타입 */
export type ExportFormat = "xlsx" | "pdf" | "csv" | "html" | "md" | "txt";

/** 추출된 컬럼 정보 (내부용) */
interface ExtractedColumn {
  key: string;
  header: string;
  width: number;
}

/** 내보내기 옵션 */
export interface ExportOptions<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  fileName?: string;
  excludeColumns?: string[];
}

/** 타임스탬프 생성 (YYYYMMDD) */
function getTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** TanStack Table 컬럼에서 key/header 추출 */
function extractColumns<T>(
  columns: ColumnDef<T, unknown>[],
  excludeColumns: string[]
): ExtractedColumn[] {
  return columns
    .filter((col) => {
      const id =
        (col as { accessorKey?: string }).accessorKey ??
        (col as { id?: string }).id;
      return id && !excludeColumns.includes(id);
    })
    .map((col) => {
      const key =
        (col as { accessorKey?: string }).accessorKey ??
        (col as { id?: string }).id ??
        "";
      const header = typeof col.header === "string" ? col.header : key;
      const size = (col as { size?: number }).size;
      return {
        key,
        header,
        width: size ? Math.max(Math.round(size / 8), 10) : 15,
      };
    });
}

/** 데이터를 2D 배열로 변환 */
function toRows<T>(data: T[], cols: ExtractedColumn[]): string[][] {
  return (data as Record<string, unknown>[]).map((row) =>
    cols.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return "";
      return String(val);
    })
  );
}

/** 브라우저에서 파일 다운로드 트리거 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Excel 내보내기 */
function exportExcel(
  headers: string[],
  rows: string[][],
  colWidths: number[],
  fileName: string
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${fileName}_${getTimestamp()}.xlsx`);
}

/** PDF 내보내기 (jsPDF + autotable standalone) */
async function exportPdf(
  headers: string[],
  rows: string[][],
  fileName: string
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  autoTable(doc, {
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 10, left: 10, right: 10 },
  });

  doc.save(`${fileName}_${getTimestamp()}.pdf`);
}

/** CSV 내보내기 */
function exportCsv(headers: string[], rows: string[][], fileName: string) {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, `${fileName}_${getTimestamp()}.csv`);
}

/** HTML 테이블 내보내기 */
function exportHtml(headers: string[], rows: string[][], fileName: string) {
  const ths = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${fileName}</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #2980b9; color: #fff; font-weight: bold; }
  tr:nth-child(even) { background: #f5f5f5; }
  tr:hover { background: #e8f4fd; }
</style>
</head>
<body>
<h2>${fileName}</h2>
<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, `${fileName}_${getTimestamp()}.html`);
}

/** Markdown 테이블 내보내기 */
function exportMarkdown(
  headers: string[],
  rows: string[][],
  fileName: string
) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map((r) => `| ${r.join(" | ")} |`);

  const md = `# ${fileName}\n\n${headerLine}\n${separatorLine}\n${bodyLines.join("\n")}\n`;
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${fileName}_${getTimestamp()}.md`);
}

/** TXT (탭 구분) 내보내기 */
function exportTxt(headers: string[], rows: string[][], fileName: string) {
  const lines = [headers.join("\t"), ...rows.map((r) => r.join("\t"))];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(blob, `${fileName}_${getTimestamp()}.txt`);
}

/**
 * 다중 포맷 데이터 내보내기 훅
 *
 * @example
 * const { exportData } = useExport();
 * exportData({ data, columns, fileName: "재고현황" }, "xlsx");
 */
export function useExport() {
  const exportData = useCallback(
    async <T>(
      {
        data,
        columns,
        fileName = "export",
        excludeColumns = ["actions", "select"],
      }: ExportOptions<T>,
      format: ExportFormat
    ) => {
      if (!data.length) return;

      const cols = extractColumns(columns, excludeColumns);
      const headers = cols.map((c) => c.header);
      const rows = toRows(data, cols);

      switch (format) {
        case "xlsx":
          exportExcel(headers, rows, cols.map((c) => c.width), fileName);
          break;
        case "pdf":
          await exportPdf(headers, rows, fileName);
          break;
        case "csv":
          exportCsv(headers, rows, fileName);
          break;
        case "html":
          exportHtml(headers, rows, fileName);
          break;
        case "md":
          exportMarkdown(headers, rows, fileName);
          break;
        case "txt":
          exportTxt(headers, rows, fileName);
          break;
      }
    },
    []
  );

  return { exportData };
}
