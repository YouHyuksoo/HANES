"use client";

/**
 * @file src/components/data-grid/ExportDropdown.tsx
 * @description 데이터 내보내기 드롭다운 버튼 컴포넌트
 *
 * 초보자 가이드:
 * 1. DataGrid 하단 푸터에 표시되는 Export 드롭다운 메뉴
 * 2. 6가지 포맷 지원: Excel, PDF, CSV, HTML, Markdown, TXT
 * 3. DataGrid에 enableExport={true} 추가하면 자동으로 표시됨
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  FileType,
  ChevronDown,
} from "lucide-react";
import { useExport, ExportFormat } from "@/hooks/useExport";
import { useTranslation } from "react-i18next";

/** 내보내기 메뉴 항목 정의 */
interface ExportMenuItem {
  format: ExportFormat;
  labelKey: string;
  icon: React.ReactNode;
  ext: string;
}

const MENU_ITEMS: ExportMenuItem[] = [
  {
    format: "xlsx",
    labelKey: "export.excel",
    icon: <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />,
    ext: ".xlsx",
  },
  {
    format: "pdf",
    labelKey: "export.pdf",
    icon: <FileText className="w-4 h-4 text-red-500 dark:text-red-400" />,
    ext: ".pdf",
  },
  {
    format: "csv",
    labelKey: "export.csv",
    icon: <FileType className="w-4 h-4 text-blue-500 dark:text-blue-400" />,
    ext: ".csv",
  },
  {
    format: "html",
    labelKey: "export.html",
    icon: <FileCode className="w-4 h-4 text-orange-500 dark:text-orange-400" />,
    ext: ".html",
  },
  {
    format: "md",
    labelKey: "export.markdown",
    icon: <FileText className="w-4 h-4 text-purple-500 dark:text-purple-400" />,
    ext: ".md",
  },
  {
    format: "txt",
    labelKey: "export.txt",
    icon: <FileType className="w-4 h-4 text-gray-500 dark:text-gray-400" />,
    ext: ".txt",
  },
];

interface ExportDropdownProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  fileName?: string;
  excludeColumns?: string[];
}

function ExportDropdown<T>({
  data,
  columns,
  fileName = "export",
  excludeColumns = ["actions", "select"],
}: ExportDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { exportData } = useExport();
  const { t } = useTranslation();

  /** 외부 클릭 시 닫기 */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  /** ESC 키로 닫기 */
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  /** 내보내기 실행 */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setIsExporting(true);
      try {
        await exportData({ data, columns, fileName, excludeColumns }, format);
      } finally {
        setIsExporting(false);
        setIsOpen(false);
      }
    },
    [data, columns, fileName, excludeColumns, exportData]
  );

  const isEmpty = !data.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isEmpty || isExporting}
        className={`
          inline-flex items-center gap-1.5 h-8 px-3
          text-xs font-semibold rounded-md
          border border-border
          transition-all duration-150
          ${isEmpty || isExporting
            ? "opacity-50 cursor-not-allowed bg-surface text-text-muted"
            : "bg-surface text-text hover:bg-card-hover hover:border-border-hover"
          }
        `}
      >
        <Download className="w-3.5 h-3.5" />
        {t("export.title")}
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* 드롭다운 메뉴 (아래쪽으로 열림) */}
      {isOpen && (
        <div
          className="
            absolute top-full right-0 mt-1 z-50
            w-48 py-1
            bg-surface border border-border rounded-lg
            shadow-lg dark:shadow-black/30
          "
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            {t("export.formatLabel")}
          </div>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.format}
              type="button"
              onClick={() => handleExport(item.format)}
              className="
                flex items-center gap-2.5 w-full px-3 py-2
                text-sm text-text
                hover:bg-primary/10 dark:hover:bg-primary/20
                transition-colors duration-100
              "
            >
              {item.icon}
              <span>{t(item.labelKey)}</span>
              <span className="ml-auto text-[10px] text-text-muted">{item.ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExportDropdown;
