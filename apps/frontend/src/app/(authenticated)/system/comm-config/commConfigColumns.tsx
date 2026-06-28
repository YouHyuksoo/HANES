"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2, Activity } from "lucide-react";
import { CommConfig } from "@/hooks/system/useCommConfigData";

/** 통신유형 배지 색상 */
const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  SERIAL: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  TCP: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
  MQTT: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  OPC_UA: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  MODBUS: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" },
};

interface CreateCommConfigGridColumnsOptions {
  t: TFunction;
  onSerialTest: (config: CommConfig) => void;
  onEditConfig: (config: CommConfig) => void;
  onDeleteConfig: (config: CommConfig) => void;
}

export function createCommConfigGridColumns({
  t,
  onSerialTest,
  onEditConfig,
  onDeleteConfig,
}: CreateCommConfigGridColumnsOptions): ColumnDef<CommConfig>[] {
  return [
      {
        id: "actions",
        header: t('common.actions'),
        size: 120,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {row.original.commType === "SERIAL" && (
              <button
                onClick={() => onSerialTest(row.original)}
                className="p-1.5 rounded hover:bg-background text-text-muted hover:text-blue-600 transition-colors"
                title={t('serialTest.title')}
              >
                <Activity className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onEditConfig(row.original)}
              className="p-1.5 rounded hover:bg-background text-text-muted hover:text-primary transition-colors"
              title={t('common.edit')}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeleteConfig(row.original)}
              className="p-1.5 rounded hover:bg-background text-text-muted hover:text-red-500 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
      {
        accessorKey: "configName",
        header: t('system.commConfig.configName'),
        size: 160,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-medium text-text">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "description",
        header: t('system.commConfig.descriptionLabel'),
        size: 160,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="text-sm text-text-muted truncate">{(getValue() as string) || "-"}</span>
        ),
      },
      {
        accessorKey: "commType",
        header: t('system.commConfig.commType'),
        size: 100,
        meta: { filterType: "multi" as const },
        cell: ({ row }) => {
          const badge = TYPE_BADGE[row.original.commType] || TYPE_BADGE.TCP;
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
              {row.original.commType}
            </span>
          );
        },
      },
      {
        accessorKey: "host",
        header: t('system.commConfig.hostLabel'),
        size: 130,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "port",
        header: t('system.commConfig.portLabel'),
        size: 70,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as number) ?? "-"}</span>,
      },
      {
        accessorKey: "baudRate",
        header: t('system.commConfig.baudRate'),
        size: 90,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return <span className="text-sm text-text">{v ? `${v.toLocaleString()}` : "-"}</span>;
        },
      },
      {
        accessorKey: "dataBits",
        header: t('system.commConfig.dataBits'),
        size: 80,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as number) ?? "-"}</span>,
      },
      {
        accessorKey: "stopBits",
        header: t('system.commConfig.stopBits'),
        size: 80,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "parity",
        header: t('system.commConfig.parity'),
        size: 80,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "flowControl",
        header: t('system.commConfig.flowControl'),
        size: 90,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "lineEnding",
        header: t('system.commConfig.lineEnding'),
        size: 80,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "useYn",
        header: t('system.commConfig.use'),
        size: 70,
        meta: { filterType: "multi" as const },
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              row.original.useYn === "Y"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {row.original.useYn === "Y" ? t('system.commConfig.inUse') : t('system.commConfig.notInUse')}
          </span>
        ),
      },
    ];
}
