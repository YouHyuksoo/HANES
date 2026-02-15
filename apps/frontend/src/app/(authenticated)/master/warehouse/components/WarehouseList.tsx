/**
 * @file src/app/(authenticated)/master/warehouse/components/WarehouseList.tsx
 * @description 창고 목록 탭 - 창고 마스터 CRUD
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Check, Search } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, ConfirmModal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { WarehouseData, WAREHOUSE_TYPE_COLORS } from '../types';
import WarehouseForm from './WarehouseForm';

/** 하네스 공장 기본 시드 데이터 */
const seedWarehouses: WarehouseData[] = [
  { id: '1', warehouseCode: 'WH-RAW-01', warehouseName: '원자재 창고 A', warehouseType: 'RAW', plantCode: 'P01', isDefault: true, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '2', warehouseCode: 'WH-RAW-02', warehouseName: '원자재 창고 B', warehouseType: 'RAW', plantCode: 'P01', isDefault: false, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '3', warehouseCode: 'WH-WIP-01', warehouseName: '절단 공정 재공', warehouseType: 'WIP', plantCode: 'P01', lineCode: 'L01', processCode: 'CUT', isDefault: true, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '4', warehouseCode: 'WH-WIP-02', warehouseName: '압착 공정 재공', warehouseType: 'WIP', plantCode: 'P01', lineCode: 'L01', processCode: 'CRM', isDefault: false, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '5', warehouseCode: 'WH-WIP-03', warehouseName: '조립 공정 재공', warehouseType: 'WIP', plantCode: 'P01', lineCode: 'L02', processCode: 'ASM', isDefault: false, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '6', warehouseCode: 'WH-FG-01', warehouseName: '완제품 창고', warehouseType: 'FG', plantCode: 'P01', isDefault: true, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '7', warehouseCode: 'WH-FG-02', warehouseName: '출하 대기 창고', warehouseType: 'FG', plantCode: 'P01', isDefault: false, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '8', warehouseCode: 'WH-FLR-01', warehouseName: '1라인 공정창고', warehouseType: 'FLOOR', plantCode: 'P01', lineCode: 'L01', isDefault: true, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '9', warehouseCode: 'WH-FLR-02', warehouseName: '2라인 공정창고', warehouseType: 'FLOOR', plantCode: 'P01', lineCode: 'L02', isDefault: false, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '10', warehouseCode: 'WH-DEF-01', warehouseName: '불량품 창고', warehouseType: 'DEFECT', plantCode: 'P01', isDefault: true, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '11', warehouseCode: 'WH-SCP-01', warehouseName: '폐기품 창고', warehouseType: 'SCRAP', plantCode: 'P01', isDefault: true, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '12', warehouseCode: 'WH-SUB-01', warehouseName: '외주 압착 창고', warehouseType: 'SUBCON', plantCode: 'P01', vendorId: 'V001', isDefault: true, useYn: 'Y', createdAt: '2026-01-01' },
  { id: '13', warehouseCode: 'WH-SUB-02', warehouseName: '외주 조립 창고', warehouseType: 'SUBCON', plantCode: 'P01', vendorId: 'V002', isDefault: false, useYn: 'Y', createdAt: '2026-01-15' },
];

export default function WarehouseList() {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<WarehouseData[]>(seedWarehouses);
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

  const getTypeLabel = (type: string) => WAREHOUSE_TYPES.find(wt => wt.value === type)?.label || type;

  const [formData, setFormData] = useState({
    warehouseCode: '', warehouseName: '', warehouseType: 'RAW',
    plantCode: '', lineCode: '', processCode: '', isDefault: false,
  });

  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const handleCreate = () => {
    setEditingWarehouse(null);
    setFormData({ warehouseCode: '', warehouseName: '', warehouseType: 'RAW', plantCode: '', lineCode: '', processCode: '', isDefault: false });
    setModalOpen(true);
  };

  const handleEdit = (warehouse: WarehouseData) => {
    setEditingWarehouse(warehouse);
    setFormData({
      warehouseCode: warehouse.warehouseCode, warehouseName: warehouse.warehouseName,
      warehouseType: warehouse.warehouseType, plantCode: warehouse.plantCode || '',
      lineCode: warehouse.lineCode || '', processCode: warehouse.processCode || '', isDefault: warehouse.isDefault,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (editingWarehouse) {
      setWarehouses(prev => prev.map(w => w.id === editingWarehouse.id ? { ...w, ...formData } : w));
    } else {
      const newId = String(Date.now());
      setWarehouses(prev => [...prev, { id: newId, ...formData, useYn: 'Y', createdAt: new Date().toISOString().slice(0, 10) } as WarehouseData]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true, title: t('inventory.warehouse.deleteWarehouse'), message: t('inventory.warehouse.deleteConfirm'),
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        setWarehouses(prev => prev.filter(w => w.id !== id));
      },
    });
  };

  const columns: ColumnDef<WarehouseData>[] = useMemo(() => [
    { accessorKey: 'warehouseCode', header: t('inventory.warehouse.warehouseCode'), size: 120 },
    { accessorKey: 'warehouseName', header: t('inventory.warehouse.warehouseName'), size: 150 },
    { accessorKey: 'warehouseType', header: t('inventory.warehouse.warehouseType'), size: 120, cell: ({ getValue }) => {
      const type = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs font-medium ${WAREHOUSE_TYPE_COLORS[type] || 'bg-gray-100 text-gray-800'}`}>{getTypeLabel(type)}</span>;
    }},
    { accessorKey: 'lineCode', header: t('inventory.warehouse.line'), size: 80, cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'processCode', header: t('inventory.warehouse.process'), size: 80, cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'isDefault', header: t('inventory.warehouse.default'), size: 60, cell: ({ getValue }) => getValue() ? <Check className="h-4 w-4 text-green-600" /> : '-' },
    { accessorKey: 'useYn', header: t('inventory.warehouse.use'), size: 60, cell: ({ getValue }) => {
      const v = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs ${v === 'Y' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{v}</span>;
    }},
    { id: 'actions', header: '', size: 100, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => handleEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t('common.edit')}><Pencil className="w-4 h-4 text-primary" /></button>
        <button onClick={() => handleDelete(row.original.id)} className="p-1 hover:bg-surface rounded" title={t('common.delete')}><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ], [t]);

  const filtered = useMemo(() => {
    let list = warehouses;
    if (filterType) list = list.filter(w => w.warehouseType === filterType);
    if (searchText) {
      const s = searchText.toLowerCase();
      list = list.filter(w => w.warehouseCode.toLowerCase().includes(s) || w.warehouseName.toLowerCase().includes(s));
    }
    return list;
  }, [warehouses, filterType, searchText]);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <Button size="sm" onClick={handleCreate}><Plus className="w-4 h-4 mr-1" />{t('inventory.warehouse.newWarehouse')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder={t('inventory.warehouse.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <Select options={WAREHOUSE_TYPES} value={filterType} onChange={(v) => setFilterType(v)} placeholder={t('inventory.warehouse.warehouseType')} />
        </div>
        <DataGrid data={filtered} columns={columns} pageSize={10} emptyMessage={t('inventory.warehouse.emptyMessage')} />
      </CardContent></Card>

      <Modal isOpen={alertModal.open} onClose={() => setAlertModal({ ...alertModal, open: false })} title={alertModal.title} size="sm">
        <p className="text-text">{alertModal.message}</p>
        <div className="flex justify-end pt-4"><Button onClick={() => setAlertModal({ ...alertModal, open: false })}>{t('common.confirm')}</Button></div>
      </Modal>

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} variant="danger" />

      <WarehouseForm isOpen={modalOpen} isEdit={!!editingWarehouse} formData={formData} typeOptions={WAREHOUSE_TYPES.filter(wt => wt.value !== '')} onClose={() => setModalOpen(false)} onChange={setFormData} onSave={handleSave} />
    </>
  );
}
