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
import {
  Radio,
  Wifi,
  Plus,
  RefreshCw,
  Cable,
  Network,
  Search,
} from "lucide-react";
import DataGrid from "@/components/data-grid/DataGrid";
import StatCard from "@/components/ui/StatCard";
import { Card, CardContent } from "@/components/ui";
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
import { createCommConfigGridColumns } from "./commConfigColumns";

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
  const columns = useMemo(
    () =>
      createCommConfigGridColumns({
        t,
        onSerialTest: setTestTarget,
        onEditConfig: openEditModal,
        onDeleteConfig: setDeleteTarget,
      }),
    [t, openEditModal, setDeleteTarget]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('system.commConfig.title')}</h1>
          <p className="text-sm text-text-muted mt-1">
            {t('system.commConfig.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchConfigs}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <StatCard label={t('system.commConfig.totalConfig')} value={stats.total} icon={Radio} color="blue" />
        <StatCard label="SERIAL" value={stats.serialCount} icon={Cable} color="green" />
        <StatCard label="TCP" value={stats.tcpCount} icon={Network} color="orange" />
        <StatCard label={t('system.commConfig.mqttOther')} value={stats.otherCount} icon={Wifi} color="purple" />
      </div>

      {/* 데이터 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={configs}
          columns={columns}
          isLoading={loading}
          enableColumnResizing
          enableColumnFilter
          enableExport
          exportFileName={t('system.commConfig.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t('system.commConfig.searchPlaceholder')}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select
                  options={FILTER_OPTIONS}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  fullWidth
                />
              </div>
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM SYS_COMM_CONFIGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

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
