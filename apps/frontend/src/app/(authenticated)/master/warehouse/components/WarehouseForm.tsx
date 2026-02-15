/**
 * @file src/app/(authenticated)/master/warehouse/components/WarehouseForm.tsx
 * @description 창고 등록/수정 모달 폼
 */
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@/components/ui';

interface WarehouseFormData {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  plantCode: string;
  lineCode: string;
  processCode: string;
  isDefault: boolean;
}

interface WarehouseFormProps {
  isOpen: boolean;
  isEdit: boolean;
  formData: WarehouseFormData;
  typeOptions: { value: string; label: string }[];
  onClose: () => void;
  onChange: (data: WarehouseFormData) => void;
  onSave: () => void;
}

export default function WarehouseForm({ isOpen, isEdit, formData, typeOptions, onClose, onChange, onSave }: WarehouseFormProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('inventory.warehouse.editWarehouse') : t('inventory.warehouse.addWarehouse')}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.warehouseCode')}</label>
          <Input value={formData.warehouseCode} onChange={(e) => onChange({ ...formData, warehouseCode: e.target.value })} disabled={isEdit} placeholder="WH-RAW" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.warehouseName')}</label>
          <Input value={formData.warehouseName} onChange={(e) => onChange({ ...formData, warehouseName: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.warehouseType')}</label>
          <Select value={formData.warehouseType} onChange={(v) => onChange({ ...formData, warehouseType: v })} options={typeOptions} />
        </div>
        {formData.warehouseType === 'FLOOR' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.lineCode')}</label>
              <Input value={formData.lineCode} onChange={(e) => onChange({ ...formData, lineCode: e.target.value })} placeholder="L01" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('inventory.warehouse.processCode')}</label>
              <Input value={formData.processCode} onChange={(e) => onChange({ ...formData, processCode: e.target.value })} placeholder="CRIMP" />
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isDefault" checked={formData.isDefault} onChange={(e) => onChange({ ...formData, isDefault: e.target.checked })} />
          <label htmlFor="isDefault" className="text-sm">{t('inventory.warehouse.setDefault')}</label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={onSave}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
