/**
 * @file src/hooks/useExcelExport.ts
 * @description Excel 파일 다운로드 공통 훅
 *
 * 초보자 가이드:
 * 1. **xlsx**: SheetJS 라이브러리 — 브라우저에서 Excel 파일 생성
 * 2. **useExcelExport**: DataGrid 등의 데이터를 Excel로 다운로드하는 훅
 * 3. 사용법: const { exportToExcel, exportGridToExcel } = useExcelExport()
 */
import { useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";

export interface ExcelColumn {
  /** 데이터 키 (accessorKey) */
  key: string;
  /** 엑셀 헤더에 표시할 이름 */
  header: string;
  /** 값 변환 함수 (선택) */
  format?: (value: unknown, row: Record<string, unknown>) => string | number;
  /** 컬럼 폭 (문자 수 기준, 기본: 15) */
  width?: number;
}

export interface ExcelExportOptions {
  /** 내보낼 데이터 배열 */
  data: Record<string, unknown>[];
  /** 컬럼 정의 (key + header) */
  columns: ExcelColumn[];
  /** 파일명 (확장자 제외, 기본: "export") */
  fileName?: string;
  /** 시트 이름 (기본: "Sheet1") */
  sheetName?: string;
}

export interface GridExportOptions<T> {
  /** 내보낼 데이터 배열 */
  data: T[];
  /** TanStack Table 컬럼 정의 (accessorKey + header 자동 추출) */
  columns: ColumnDef<T, unknown>[];
  /** 파일명 (확장자 제외) */
  fileName?: string;
  /** 시트 이름 (기본: "Sheet1") */
  sheetName?: string;
  /** 제외할 컬럼 ID 목록 (예: ['actions', 'select']) */
  excludeColumns?: string[];
}

function generateFile(
  headers: string[],
  rows: unknown[][],
  colWidths: number[],
  fileName: string,
  sheetName: string
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(wb, `${fileName}_${ts}.xlsx`);
}

/**
 * Excel 다운로드 공통 훅
 *
 * @example
 * // 방법 1: 수동 컬럼 지정
 * exportToExcel({ data, columns: [{ key: 'partNo', header: '품번' }], fileName: '품목' });
 *
 * // 방법 2: TanStack Table 컬럼에서 자동 추출
 * exportGridToExcel({ data, columns: gridColumns, fileName: '품목', excludeColumns: ['actions'] });
 */
export function useExcelExport() {
  const exportToExcel = useCallback(
    ({ data, columns, fileName = "export", sheetName = "Sheet1" }: ExcelExportOptions) => {
      const headers = columns.map((c) => c.header);
      const rows = data.map((row) =>
        columns.map((col) => {
          if (col.format) return col.format(row[col.key], row);
          const val = row[col.key];
          return val ?? "";
        })
      );
      generateFile(headers, rows, columns.map((c) => c.width ?? 15), fileName, sheetName);
    },
    []
  );

  const exportGridToExcel = useCallback(
    <T,>({ data, columns, fileName = "export", sheetName = "Sheet1", excludeColumns = ["actions", "select"] }: GridExportOptions<T>) => {
      // TanStack Table 컬럼에서 accessorKey와 header 자동 추출
      const exportCols = columns
        .filter((col) => {
          const id = (col as { accessorKey?: string }).accessorKey ?? (col as { id?: string }).id;
          return id && !excludeColumns.includes(id);
        })
        .map((col) => {
          const key = (col as { accessorKey?: string }).accessorKey ?? (col as { id?: string }).id ?? "";
          const header = typeof col.header === "string" ? col.header : key;
          const size = (col as { size?: number }).size;
          return { key, header, width: size ? Math.max(Math.round(size / 8), 10) : 15 };
        });

      const headers = exportCols.map((c) => c.header);
      const rows = (data as Record<string, unknown>[]).map((row) =>
        exportCols.map((col) => {
          const val = row[col.key];
          return val ?? "";
        })
      );
      generateFile(headers, rows, exportCols.map((c) => c.width), fileName, sheetName);
    },
    []
  );

  return { exportToExcel, exportGridToExcel };
}
