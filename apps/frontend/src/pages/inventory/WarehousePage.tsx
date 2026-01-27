/**
 * @file src/pages/inventory/WarehousePage.tsx
 * @description 창고 관리 페이지 - 창고 마스터 CRUD
 */
import { useState, useEffect, useMemo } from 'react';
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

const WAREHOUSE_TYPES = [
  { value: '', label: '전체' },
  { value: 'RAW', label: '원자재 창고' },
  { value: 'WIP', label: '반제품 창고' },
  { value: 'FG', label: '완제품 창고' },
  { value: 'FLOOR', label: '공정재공' },
  { value: 'DEFECT', label: '불량 창고' },
  { value: 'SCRAP', label: '폐기 창고' },
  { value: 'SUBCON', label: '외주처' },
];

const getWarehouseTypeLabel = (type: string) => {
  return WAREHOUSE_TYPES.find(t => t.value === type)?.label || type;
};

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
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
  const [filterType, setFilterType] = useState('');
  const [searchText, setSearchText] = useState('');

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
  const [alertModal, setAlertModal] = useState({ open: false, title: '알림', message: '' });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '확인', message: '', onConfirm: () => {},
  });

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const params = filterType ? `?warehouseType=${filterType}` : '';
      const res = await api.get(`/inventory/warehouses${params}`);
      setWarehouses(res.data);
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
      setAlertModal({ open: true, title: '저장 실패', message: '저장에 실패했습니다.' });
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true,
      title: '창고 삭제',
      message: '정말 삭제하시겠습니까?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          await api.delete(`/inventory/warehouses/${id}`);
          fetchWarehouses();
        } catch (error) {
          console.error('창고 삭제 실패:', error);
          setAlertModal({ open: true, title: '삭제 실패', message: '삭제에 실패했습니다. 재고가 있는 창고는 삭제할 수 없습니다.' });
        }
      },
    });
  };

  const handleInitWarehouses = () => {
    setConfirmModal({
      open: true,
      title: '기본 창고 초기화',
      message: '기본 창고를 초기화하시겠습니까?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          await api.post('/inventory/warehouses/init');
          fetchWarehouses();
          setAlertModal({ open: true, title: '완료', message: '기본 창고가 초기화되었습니다.' });
        } catch (error) {
          console.error('창고 초기화 실패:', error);
          setAlertModal({ open: true, title: '오류', message: '창고 초기화 중 오류가 발생했습니다.' });
        }
      },
    });
  };

  const columns: ColumnDef<WarehouseData>[] = useMemo(() => [
    {
      accessorKey: 'warehouseCode',
      header: '창고코드',
      size: 120,
    },
    {
      accessorKey: 'warehouseName',
      header: '창고명',
      size: 150,
    },
    {
      accessorKey: 'warehouseType',
      header: '창고유형',
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
      header: '라인',
      size: 80,
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'processCode',
      header: '공정',
      size: 80,
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'isDefault',
      header: '기본',
      size: 60,
      cell: ({ getValue }) => getValue() ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : '-',
    },
    {
      accessorKey: 'useYn',
      header: '사용',
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
          <button onClick={() => handleEdit(row.original)} className="p-1 hover:bg-surface rounded" title="수정">
            <Pencil className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => handleDelete(row.original.id)} className="p-1 hover:bg-surface rounded" title="삭제">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], []);

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
            <Warehouse className="w-7 h-7 text-primary" />창고 관리
          </h1>
          <p className="text-text-muted mt-1">창고 마스터 정보를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleInitWarehouses}>기본창고 초기화</Button>
          <Button size="sm" onClick={handleCreate}><Plus className="w-4 h-4 mr-1" />신규 등록</Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="창고코드, 창고명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={WAREHOUSE_TYPES} value={filterType} onChange={(v) => setFilterType(v)} placeholder="창고유형" />
            <Button variant="secondary" onClick={fetchWarehouses}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid
            data={filteredWarehouses}
            columns={columns}
            isLoading={loading}
            pageSize={10}
            emptyMessage="등록된 창고가 없습니다."
          />
        </CardContent>
      </Card>

      {/* 알림 모달 */}
      <Modal isOpen={alertModal.open} onClose={() => setAlertModal({ ...alertModal, open: false })} title={alertModal.title} size="sm">
        <p className="text-text">{alertModal.message}</p>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setAlertModal({ ...alertModal, open: false })}>확인</Button>
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
        title={editingWarehouse ? '창고 수정' : '창고 등록'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">창고코드</label>
            <Input
              value={formData.warehouseCode}
              onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value })}
              disabled={!!editingWarehouse}
              placeholder="WH-RAW"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">창고명</label>
            <Input
              value={formData.warehouseName}
              onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
              placeholder="원자재 창고"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">창고유형</label>
            <Select
              value={formData.warehouseType}
              onChange={(v) => setFormData({ ...formData, warehouseType: v })}
              options={WAREHOUSE_TYPES.filter(t => t.value !== '')}
            />
          </div>
          {formData.warehouseType === 'FLOOR' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">라인코드</label>
                <Input
                  value={formData.lineCode}
                  onChange={(e) => setFormData({ ...formData, lineCode: e.target.value })}
                  placeholder="L01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">공정코드</label>
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
            <label htmlFor="isDefault" className="text-sm">기본 창고로 지정</label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>
              저장
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
