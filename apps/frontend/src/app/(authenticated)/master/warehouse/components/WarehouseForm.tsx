/**
 * @file src/app/(authenticated)/master/warehouse/components/WarehouseForm.tsx
 * @description 창고 등록/수정 모달 폼
 */
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '@/components/ui';
import { HelpTooltip } from '@/components/shared';
import { FieldInput, FieldLineSelect, FieldProcessSelect, FieldSelect, WAREHOUSE_FIELD_HELP } from './WarehouseFieldHelp';

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
        <FieldInput
          field="warehouseCode"
          label={t('inventory.warehouse.warehouseCode')}
          value={formData.warehouseCode}
          onChange={(e) => onChange({ ...formData, warehouseCode: e.target.value })}
          disabled={isEdit}
        />
        <FieldInput
          field="warehouseName"
          label={t('inventory.warehouse.warehouseName')}
          value={formData.warehouseName}
          onChange={(e) => onChange({ ...formData, warehouseName: e.target.value })}
        />
        <FieldSelect
          field="warehouseType"
          label={t('inventory.warehouse.warehouseType')}
          value={formData.warehouseType}
          onChange={(v) => onChange({ ...formData, warehouseType: v })}
          options={typeOptions}
        />
        {formData.warehouseType === 'FLOOR' && (
          <>
            <FieldLineSelect
              field="lineCode"
              label={t('inventory.warehouse.lineCode')}
              value={formData.lineCode}
              onChange={(v) => onChange({ ...formData, lineCode: v })}
            />
            <FieldProcessSelect
              field="processCode"
              label={t('inventory.warehouse.processCode')}
              value={formData.processCode}
              onChange={(v) => onChange({ ...formData, processCode: v })}
            />
          </>
        )}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isDefault" checked={formData.isDefault} onChange={(e) => onChange({ ...formData, isDefault: e.target.checked })} />
          <label htmlFor="isDefault" className="flex items-center gap-1 text-sm">
            <span>{t('inventory.warehouse.setDefault')}</span>
            <HelpTooltip
              description={t('master.warehouse.fieldHelp.isDefault', WAREHOUSE_FIELD_HELP.isDefault.description)}
              db={WAREHOUSE_FIELD_HELP.isDefault.db}
              dataField="isDefault"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={onSave}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
