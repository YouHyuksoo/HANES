"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, ComCodeBadge, Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";

interface Equipment {
  equipCode: string;
  equipName: string;
  equipType: string | null;
  modelName: string | null;
  maker: string | null;
  lineCode: string | null;
  status: string;
  useYn: string;
}

interface ProcessEquipGridProps {
  processCode: string;
  processName: string;
  equipments: Equipment[];
  isLoading: boolean;
  onAdd: () => void;
  onRemove: (equipment: Equipment) => void;
}

export default function ProcessEquipGrid({
  processCode,
  processName,
  equipments,
  isLoading,
  onAdd,
  onRemove,
}: ProcessEquipGridProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<Equipment>[]>(
    () => [
      { accessorKey: "equipCode", header: t("equipment.master.equipCode", { defaultValue: "설비코드" }), size: 120 },
      { accessorKey: "equipName", header: t("equipment.master.equipName", { defaultValue: "설비명" }), size: 160 },
      {
        accessorKey: "equipType",
        header: t("equipment.master.equipType", { defaultValue: "설비유형" }),
        size: 110,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? <ComCodeBadge groupCode="EQUIP_TYPE" code={v} /> : "-";
        },
      },
      { accessorKey: "modelName", header: t("equipment.master.modelName", { defaultValue: "모델명" }), size: 130, cell: ({ getValue }) => (getValue() as string) || "-" },
      { accessorKey: "maker", header: t("equipment.master.maker", { defaultValue: "제조사" }), size: 110, cell: ({ getValue }) => (getValue() as string) || "-" },
      { accessorKey: "lineCode", header: t("equipment.master.lineCode", { defaultValue: "라인코드" }), size: 100, cell: ({ getValue }) => (getValue() as string) || "-" },
      {
        accessorKey: "status",
        header: t("equipment.master.status", { defaultValue: "상태" }),
        size: 80,
        cell: ({ getValue }) => <ComCodeBadge groupCode="EQUIP_STATUS" code={getValue() as string} />,
      },
      {
        accessorKey: "useYn",
        header: t("common.useYn", { defaultValue: "사용여부" }),
        size: 60,
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return (
            <span className={`px-1.5 py-0.5 text-xs rounded ${v === "Y" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
              {v}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 50,
        meta: { align: "center" as const, filterType: "none" as const },
        cell: ({ row }) => (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRemove(row.original);
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        ),
      },
    ],
    [t, onRemove],
  );

  if (!processCode) {
    return (
      <Card className="flex-1 flex items-center justify-center min-h-0">
        <div className="text-center text-text-muted">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("master.process.noProcessSelected")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-4 pb-2 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" />
              {t("master.process.assignedEquipments")}
              <span className="text-text-muted font-normal">
                - {processCode} ({processName})
              </span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {equipments.length}{t("common.count", { defaultValue: "건" })}
            </p>
          </div>
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" />
            {t("master.process.assignEquipment", "설비 배치")}
          </Button>
        </div>
      </div>
      <CardContent className="flex-1 min-h-0 overflow-hidden">
        <DataGrid
          data={equipments}
          columns={columns}
          isLoading={isLoading}
          enableColumnFilter
          enableExport
          exportFileName={`${processCode}_${t("master.process.assignedEquipments")}`}
        
        sqlQuery={`SELECT *\nFROM PROCESS_EQUIPS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent>
    </Card>
  );
}
