/**
 * @file src/app/(authenticated)/system/comm-config/page.tsx
 * @description 통신설정 관리 페이지
 *
 * 초보자 가이드:
 * 1. **통계 카드**: 전체/SERIAL/TCP/기타 개수 표시
 * 2. **DataGrid**: 통신설정 목록 + 필터 + 검색
 * 3. **Modal**: CommConfigForm으로 생성/수정
 * 4. **ConfirmModal**: 삭제 확인
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Radio,
  Wifi,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Cable,
  Network,
  Activity,
} from "lucide-react";
import DataGrid from "@/components/data-grid/DataGrid";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import CommConfigForm from "@/components/system/CommConfigForm";
import SerialTestModal from "@/components/system/SerialTestModal";
import {
  useCommConfigData,
  CommConfig,
  CommConfigFormData,
} from "@/hooks/system/useCommConfigData";

/** 통신유형 배지 색상 */
const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  SERIAL: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  TCP: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
  MQTT: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  OPC_UA: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  MODBUS: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" },
};

export default function CommConfigPage() {
  const { t } = useTranslation();
  const [testTarget, setTestTarget] = useState<CommConfig | null>(null);

  const FILTER_OPTIONS = useMemo(() => [
    { value: "", label: t('common.all') },
    { value: "SERIAL", label: "SERIAL" },
    { value: "TCP", label: "TCP" },
    { value: "MQTT", label: "MQTT" },
    { value: "OPC_UA", label: "OPC-UA" },
    { value: "MODBUS", label: "Modbus" },
  ], [t]);

  const {
    configs,
    loading,
    stats,
    typeFilter,
    setTypeFilter,
    searchText,
    setSearchText,
    isModalOpen,
    editingConfig,
    deleteTarget,
    setDeleteTarget,
    formData,
    setFormData,
    formError,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSave,
    handleDelete,
    fetchConfigs,
  } = useCommConfigData();

  /** 폼 필드 변경 핸들러 */
  const handleFormChange = (
    field: keyof CommConfigFormData,
    value: string | Record<string, unknown>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** DataGrid 컬럼 정의 */
  const columns = useMemo<ColumnDef<CommConfig>[]>(
    () => [
      {
        id: "actions",
        header: t('common.actions'),
        size: 120,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {row.original.commType === "SERIAL" && (
              <button
                onClick={() => setTestTarget(row.original)}
                className="p-1.5 rounded hover:bg-background text-text-muted hover:text-blue-600 transition-colors"
                title={t('serialTest.title')}
              >
                <Activity className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => openEditModal(row.original)}
              className="p-1.5 rounded hover:bg-background text-text-muted hover:text-primary transition-colors"
              title={t('common.edit')}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(row.original)}
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
        cell: ({ getValue }) => (
          <span className="font-medium text-text">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "description",
        header: t('system.commConfig.descriptionLabel'),
        size: 160,
        cell: ({ getValue }) => (
          <span className="text-sm text-text-muted truncate">{(getValue() as string) || "-"}</span>
        ),
      },
      {
        accessorKey: "commType",
        header: t('system.commConfig.commType'),
        size: 100,
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
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "port",
        header: t('system.commConfig.portLabel'),
        size: 70,
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as number) ?? "-"}</span>,
      },
      {
        accessorKey: "portName",
        header: t('system.commConfig.portName'),
        size: 80,
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "baudRate",
        header: t('system.commConfig.baudRate'),
        size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return <span className="text-sm text-text">{v ? `${v.toLocaleString()}` : "-"}</span>;
        },
      },
      {
        accessorKey: "dataBits",
        header: t('system.commConfig.dataBits'),
        size: 80,
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as number) ?? "-"}</span>,
      },
      {
        accessorKey: "stopBits",
        header: t('system.commConfig.stopBits'),
        size: 80,
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "parity",
        header: t('system.commConfig.parity'),
        size: 80,
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "flowControl",
        header: t('system.commConfig.flowControl'),
        size: 90,
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "lineEnding",
        header: t('system.commConfig.lineEnding'),
        size: 80,
        cell: ({ getValue }) => <span className="text-sm text-text">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "useYn",
        header: t('system.commConfig.use'),
        size: 70,
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
    ],
    [t, openEditModal, setDeleteTarget]
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('system.commConfig.title')}</h1>
          <p className="text-sm text-text-muted mt-1">
            {t('system.commConfig.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchConfigs}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('system.commConfig.totalConfig')} value={stats.total} icon={Radio} color="blue" />
        <StatCard label="SERIAL" value={stats.serialCount} icon={Cable} color="green" />
        <StatCard label="TCP" value={stats.tcpCount} icon={Network} color="orange" />
        <StatCard label={t('system.commConfig.mqttOther')} value={stats.otherCount} icon={Wifi} color="purple" />
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select
            options={FILTER_OPTIONS}
            value={typeFilter}
            onChange={setTypeFilter}
            fullWidth
          />
        </div>
        <div className="w-64">
          <Input
            placeholder={t('system.commConfig.searchPlaceholder')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            fullWidth
          />
        </div>
      </div>

      {/* 데이터 그리드 */}
      <DataGrid
        data={configs}
        columns={columns}
        isLoading={loading}
        enableColumnResizing
      />

      {/* 생성/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingConfig ? t('system.commConfig.editConfig') : t('system.commConfig.addConfig')}
        size="lg"
      >
        <CommConfigForm
          formData={formData}
          onChange={handleFormChange}
          error={formError}
          isEdit={!!editingConfig}
        />
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={closeModal}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {editingConfig ? t('common.edit') : t('common.create')}
          </Button>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('system.commConfig.deleteConfig')}
        message={t('system.commConfig.deleteConfirm', { name: deleteTarget?.configName })}
        variant="danger"
      />

      {/* 시리얼 통신 테스트 모달 */}
      <SerialTestModal
        isOpen={!!testTarget}
        onClose={() => setTestTarget(null)}
        config={testTarget}
      />
    </div>
  );
}
