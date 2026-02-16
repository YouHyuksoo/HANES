/**
 * @file src/lib/table-utils/column-factories.tsx
 * @description DataGrid 컬럼 생성 팩토리 함수들
 *
 * 사용법:
 * ```tsx
 * const columns = useMemo(() => [
 *   ...createPartColumns(t),
 *   createStatusColumn(t, 'JOB_ORDER_STATUS'),
 *   createQtyColumn(t, 'quantity'),
 *   createDateColumn(t, 'createdAt'),
 *   createActionsColumn(t, { onEdit, onDelete }),
 * ], [t, onEdit, onDelete]);
 * ```
 */

import { ColumnDef, CellContext } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { ComCodeBadge } from "@/components/ui";
import Button from "@/components/ui/Button";

// ========================================
// 공통 Cell 렌더러
// ========================================

/**
 * 수량 Cell (천단위 구분 + 우측 정렬)
 */
export function QtyCell<T>({ getValue }: CellContext<T, unknown>) {
  const value = getValue();
  if (value === null || value === undefined) return "-";
  return <span className="text-right block">{Number(value).toLocaleString()}</span>;
}

/**
 * 날짜 Cell (YYYY-MM-DD 형식)
 */
export function DateCell<T>({ getValue }: CellContext<T, unknown>) {
  const value = getValue();
  if (!value) return "-";
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 날짜시간 Cell (YYYY-MM-DD HH:mm 형식)
 */
export function DateTimeCell<T>({ getValue }: CellContext<T, unknown>) {
  const value = getValue();
  if (!value) return "-";
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 사용여부 Cell (Y/N)
 */
export function UseYnCell<T>({ getValue }: CellContext<T, unknown>) {
  const value = getValue();
  const isActive = value === "Y" || value === true;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {isActive ? "사용" : "미사용"}
    </span>
  );
}

// ========================================
// 컬럼 생성 팩토리
// ========================================

export interface ColumnFactoryOptions {
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableSorting?: boolean;
}

/**
 * 품목 코드 + 명칭 컬럼 생성
 */
export function createPartColumns<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown>[] {
  return [
    {
      accessorKey: "partCode",
      header: t("part.code", "품목코드"),
      size: options.size ?? 120,
      minSize: options.minSize ?? 80,
    },
    {
      accessorKey: "partName",
      header: t("part.name", "품목명"),
      size: options.size ?? 200,
      minSize: options.minSize ?? 100,
    },
  ];
}

/**
 * 상태 컬럼 생성 (ComCodeBadge 사용)
 */
export function createStatusColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  groupCode: string,
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey: "status",
    header: t("common.status", "상태"),
    size: options.size ?? 100,
    cell: ({ getValue }) => (
      <ComCodeBadge groupCode={groupCode} code={getValue() as string} />
    ),
  };
}

/**
 * 수량 컬럼 생성
 */
export function createQtyColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  accessorKey: string = "qty",
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey,
    header: t("common.qty", "수량"),
    size: options.size ?? 100,
    cell: QtyCell,
    meta: { align: "right" },
  };
}

/**
 * 단위 컬럼 생성
 */
export function createUnitColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey: "unit",
    header: t("common.unit", "단위"),
    size: options.size ?? 80,
    cell: ({ getValue }) => getValue() || "EA",
  };
}

/**
 * 날짜 컬럼 생성
 */
export function createDateColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  accessorKey: string,
  header?: string,
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey,
    header: header || t(`common.${accessorKey}`, accessorKey),
    size: options.size ?? 120,
    cell: DateCell,
    meta: { align: "center" },
  };
}

/**
 * 날짜시간 컬럼 생성
 */
export function createDateTimeColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  accessorKey: string,
  header?: string,
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey,
    header: header || t(`common.${accessorKey}`, accessorKey),
    size: options.size ?? 150,
    cell: DateTimeCell,
    meta: { align: "center" },
  };
}

/**
 * 사용여부 컬럼 생성
 */
export function createUseYnColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey: "useYn",
    header: t("common.useYn", "사용여부"),
    size: options.size ?? 90,
    cell: UseYnCell,
    meta: { align: "center" },
  };
}

/**
 * Action 버튼 컬럼 생성
 */
export interface ActionsColumnHandlers<T> {
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onView?: (row: T) => void;
}

export function createActionsColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  handlers: ActionsColumnHandlers<T>,
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    id: "actions",
    header: t("common.actions", "작업"),
    size: options.size ?? 150,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        {handlers.onView && (
          <Button size="sm" variant="outline" onClick={() => handlers.onView!(row.original)}>
            {t("common.view", "보기")}
          </Button>
        )}
        {handlers.onEdit && (
          <Button size="sm" variant="outline" onClick={() => handlers.onEdit!(row.original)}>
            {t("common.edit", "수정")}
          </Button>
        )}
        {handlers.onDelete && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:bg-red-50"
            onClick={() => handlers.onDelete!(row.original)}
          >
            {t("common.delete", "삭제")}
          </Button>
        )}
      </div>
    ),
  };
}

/**
 * 설비 코드 + 명칭 컬럼 생성
 */
export function createEquipColumns<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown>[] {
  return [
    {
      accessorKey: "equipCode",
      header: t("equip.code", "설비코드"),
      size: options.size ?? 120,
    },
    {
      accessorKey: "equipName",
      header: t("equip.name", "설비명"),
      size: options.size ?? 150,
    },
  ];
}

/**
 * 작업자 코드 + 명칭 컬럼 생성
 */
export function createWorkerColumns<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown>[] {
  return [
    {
      accessorKey: "workerCode",
      header: t("worker.code", "작업자코드"),
      size: options.size ?? 120,
    },
    {
      accessorKey: "workerName",
      header: t("worker.name", "작업자명"),
      size: options.size ?? 120,
    },
  ];
}

/**
 * 거래처 코드 + 명칭 컬럼 생성
 */
export function createPartnerColumns<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown>[] {
  return [
    {
      accessorKey: "partnerCode",
      header: t("partner.code", "거래처코드"),
      size: options.size ?? 120,
    },
    {
      accessorKey: "partnerName",
      header: t("partner.name", "거래처명"),
      size: options.size ?? 150,
    },
  ];
}

/**
 * 창고 코드 + 명칭 컬럼 생성
 */
export function createWarehouseColumns<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown>[] {
  return [
    {
      accessorKey: "warehouseCode",
      header: t("warehouse.code", "창고코드"),
      size: options.size ?? 120,
    },
    {
      accessorKey: "warehouseName",
      header: t("warehouse.name", "창고명"),
      size: options.size ?? 150,
    },
  ];
}

/**
 * LOT 번호 컬럼 생성
 */
export function createLotNoColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey: "lotNo",
    header: t("lot.no", "LOT번호"),
    size: options.size ?? 150,
  };
}

/**
 * 비고 컬럼 생성
 */
export function createRemarkColumn<T>(
  t: ReturnType<typeof useTranslation>["t"],
  options: ColumnFactoryOptions = {}
): ColumnDef<T, unknown> {
  return {
    accessorKey: "remark",
    header: t("common.remark", "비고"),
    size: options.size ?? 200,
    cell: ({ getValue }) => {
      const value = getValue() as string;
      if (!value) return "-";
      return (
        <span className="truncate max-w-[200px] block" title={value}>
          {value}
        </span>
      );
    },
  };
}
