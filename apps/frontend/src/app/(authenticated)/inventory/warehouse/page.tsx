"use client";

/**
 * @file src/pages/inventory/WarehousePage.tsx
 * @description 창고 관리 페이지 - 창고 마스터 CRUD
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Warehouse, Plus, RefreshCw, Pencil, Trash2, Check, Search } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, ConfirmModal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/services/api';

interface WarehouseData {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  plantCode?: string;
  lineCode?: string;
  processCode?: string;
  vendorId?: string;
  isDefault: boolean;
  useYn: string;
  createdAt: string;
}

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    RAW: 'bg-blue-100 text-blue-800',
    WIP: 'bg-yellow-100 text-yellow-800',
    FG: 'bg-green-100 text-green-800',
    FLOOR: 'bg-purple-100 text-purple-800',
    DEFECT: 'bg-red-100 text-red-800',
    SCRAP: 'bg-gray-100 text-gray-800',
    SUBCON: 'bg-orange-100 text-orange-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

export default function WarehousePage() {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
  const [filterType, setFilterType] = useState('');
  const [searchText, setSearchText] = useState('');

  const WAREHOUSE_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'RAW', label: t('inventory.warehouse.rawWarehouse') },
    { value: 'WIP', label: t('inventory.warehouse.wipWarehouse') },
    { value: 'FG', label: t('inventory.warehouse.fgWarehouse') },
    { value: 'FLOOR', label: t('inventory.warehouse.floorWarehouse') },
    { value: 'DEFECT', label: t('inventory.warehouse.defectWarehouse') },
    { value: 'SCRAP', label: t('inventory.warehouse.scrapWarehouse') },
    { value: 'SUBCON', label: t('inventory.warehouse.subconWarehouse') },
  ], [t]);

  const getWarehouseTypeLabel = (type: string) => {
    return WAREHOUSE_TYPES.find(wt => wt.value === type)?.label || type;
  };

  // Form state
  const [formData, setFormData] = useState({
    warehouseCode: '',
    warehouseName: '',
    warehouseType: 'RAW',
    plantCode: '',
    lineCode: '',
    processCode: '',
    isDefault: false,
  });

  // 알림/확인 모달 상태
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const params = filterType ? `?warehouseType=${filterType}` : '';
      const res = await api.get(`/inventory/warehouses${params}`);
      const result = res.data?.data ?? res.data;
      setWarehouses(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('창고 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [filterType]);

  const handleCreate = () => {
    setEditingWarehouse(null);
    setFormData({
      warehouseCode: '',
      warehouseName: '',
      warehouseType: 'RAW',
      plantCode: '',
      lineCode: '',
      processCode: '',
      isDefault: false,
    });
    setModalOpen(true);
  };

  const handleEdit = (warehouse: WarehouseData) => {
    setEditingWarehouse(warehouse);
    setFormData({
      warehouseCode: warehouse.warehouseCode,
      warehouseName: warehouse.warehouseName,
      warehouseType: warehouse.warehouseType,
      plantCode: warehouse.plantCode || '',
      lineCode: warehouse.lineCode || '',
      processCode: warehouse.processCode || '',
      isDefault: warehouse.isDefault,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingWarehouse) {
        await api.put(`/inventory/warehouses/${editingWarehouse.id}`, formData);
      } else {
        await api.post('/inventory/warehouses', formData);
      }
      setModalOpen(false);
      fetchWarehouses();
    } catch (error) {
      console.error('창고 저장 실패:', error);
      setAlertModal({ open: true, title: t('common.error'), message: t('common.saveFailed') });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true,
      title: t('inventory.warehouse.deleteWarehouse'),
      message: t('inventory.warehouse.deleteConfirm'),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          await api.delete(`/inventory/warehouses/${id}`);
          fetchWarehouses();
        } catch (error) {
          console.error('창고 삭제 실패:', error);
          setAlertModal({ open: true, title: t('common.error'), message: t('inventory.warehouse.deleteFailed') });
        }
      },
    });
  };

  const handleInitWarehouses = () => {
    setConfirmModal({
      open: true,
      title: t('inventory.warehouse.initWarehouses'),
      message: t('inventory.warehouse.initConfirm'),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          await api.post('/inventory/warehouses/init');
          fetchWarehouses();
          setAlertModal({ open: true, title: t('common.confirm'), message: t('inventory.warehouse.initComplete') });
        } catch (error) {
          console.error('창고 초기화 실패:', error);
          setAlertModal({ open: true, title: t('common.error'), message: t('inventory.warehouse.initFailed') });
        }
      },
    });
  };

  const columns: ColumnDef<WarehouseData>[] = useMemo(() => [
    {
      accessorKey: 'warehouseCode',
      header: t('inventory.warehouse.warehouseCode'),
      size: 120,
    },
    {
      accessorKey: 'warehouseName',
      header: t('inventory.warehouse.warehouseName'),
      size: 150,
    },
    {
      accessorKey: 'warehouseType',
      header: t('inventory.warehouse.warehouseType'),
      size: 120,
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(type)}`}>
            {getWarehouseTypeLabel(type)}
          </span>
        );
      },
    },
    {
      accessorKey: 'lineCode',
      header: t('inventory.warehouse.line'),
      size: 80,
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'processCode',
      header: t('inventory.warehouse.process'),
      size: 80,
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'isDefault',
      header: t('inventory.warehouse.default'),
      size: 60,
      cell: ({ getValue }) => getValue() ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : '-',
    },
    {
      accessorKey: 'useYn',
      header: t('inventory.warehouse.use'),
      size: 60,
      cell: ({ getValue }) => {
        const useYn = getValue() as string;
        return (
          <span className={`px-2 py-1 rounded text-xs ${useYn === 'Y' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {useYn}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => handleEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t('common.edit')}>
            <Pencil className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => handleDelete(row.original.id)} className="p-1 hover:bg-surface rounded" title={t('common.delete')}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t]);

  const filteredWarehouses = useMemo(() => {
    if (!searchText) return warehouses;
    const s = searchText.toLowerCase();
    return warehouses.filter(
      (w) => w.warehouseCode.toLowerCase().includes(s) || w.warehouseName.toLowerCase().includes(s),
    );
  }, [warehouses, searchText]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" />{t('inventory.warehouse.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('inventory.warehouse.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleInitWarehouses}>{t('inventory.warehouse.initWarehouses')}</Button>
          <Button size="sm" onClick={handleCreate}><Plus className="w-4 h-4 mr-1" />{t('inventory.warehouse.newWarehouse')}</Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('inventory.warehouse.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={WAREHOUSE_TYPES} value={filterType} onChange={(v) => setFilterType(v)} placeholder={t('inventory.warehouse.warehouseType')} />
            <Button variant="secondary" onClick={fetchWarehouses}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid
            data={filteredWarehouses}
            columns={columns}
            isLoading={loading}
            pageSize={10}
            emptyMessage={t('inventory.warehouse.emptyMessage')}
          />
        </CardContent>
      </Card>

      {/* 알림 모달 */}
      <Modal isOpen={alertModal.open} onClose={() => setAlertModal({ ...alertModal, open: false })} title={alertModal.title} size="sm">
        <p className="text-text">{alertModal.message}</p>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setAlertModal({ ...alertModal, open: false })}>{t('common.confirm')}</Button>
        </div>
      </Modal>

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
      />

      {/* 창고 등록/수정 모달 */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWarehouse ? t('inventory.warehouse.editWarehouse') : t('inventory.warehouse.addWarehouse')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.warehouseCode')}</label>
            <Input
              value={formData.warehouseCode}
              onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value })}
              disabled={!!editingWarehouse}
              placeholder="WH-RAW"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.warehouseName')}</label>
            <Input
              value={formData.warehouseName}
              onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.warehouseType')}</label>
            <Select
              value={formData.warehouseType}
              onChange={(v) => setFormData({ ...formData, warehouseType: v })}
              options={WAREHOUSE_TYPES.filter(wt => wt.value !== '')}
            />
          </div>
          {formData.warehouseType === 'FLOOR' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.lineCode')}</label>
                <Input
                  value={formData.lineCode}
                  onChange={(e) => setFormData({ ...formData, lineCode: e.target.value })}
                  placeholder="L01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.processCode')}</label>
                <Input
                  value={formData.processCode}
                  onChange={(e) => setFormData({ ...formData, processCode: e.target.value })}
                  placeholder="CRIMP"
                />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
            />
            <label htmlFor="isDefault" className="text-sm">{t('inventory.warehouse.setDefault')}</label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
