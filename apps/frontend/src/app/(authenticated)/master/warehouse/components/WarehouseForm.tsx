/**
 * @file src/app/(authenticated)/master/warehouse/components/WarehouseForm.tsx
 * @description 창고 등록/수정 모달 폼
 */
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
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
  isEdit: boolean;
  formData: WarehouseFormData;
  typeOptions: { value: string; label: string }[];
  onClose: () => void;
  onChange: (data: WarehouseFormData) => void;
  onSave: () => void;
  saving?: boolean;
}

export default function WarehouseForm({ isEdit, formData, typeOptions, onClose, onChange, onSave, saving }: WarehouseFormProps) {
  const { t } = useTranslation();

  return (
    <div className="w-[440px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t('inventory.warehouse.editWarehouse') : t('inventory.warehouse.addWarehouse')}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={onSave} disabled={saving || !formData.warehouseCode || !formData.warehouseName || !formData.warehouseType}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
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
          required
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
      </div>
    </div>
  );
}
