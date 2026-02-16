/**
 * @file src/app/(authenticated)/master/company/components/CompanyForm.tsx
 * @description 회사 추가/수정 모달 폼 컴포넌트
 *
 * 초보자 가이드:
 * 1. **Modal**: 회사 정보 입력 폼 (추가/수정 공용)
 * 2. **formData**: 부모에서 전달받아 양방향 업데이트
 */
"use client";

import { useTranslation } from "react-i18next";
import { Modal, Input, Button } from "@/components/ui";
import { Company } from "../types";

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingCompany: Company | null;
  formData: Partial<Company>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Company>>>;
  onSave: () => void;
  saving: boolean;
}

function CompanyForm({ isOpen, onClose, editingCompany, formData, setFormData, onSave, saving }: CompanyFormProps) {
  const { t } = useTranslation();
  const update = (field: keyof Company, value: string) => setFormData((p) => ({ ...p, [field]: value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCompany ? t("master.company.editCompany") : t("master.company.addCompany")}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t("master.company.companyCode")}
          placeholder="COMP-001"
          value={formData.companyCode || ""}
          onChange={(e) => update("companyCode", e.target.value)}
          disabled={!!editingCompany}
          fullWidth
        />
        <Input
          label={t("master.company.companyName")}
          placeholder={t("master.company.companyName")}
          value={formData.companyName || ""}
          onChange={(e) => update("companyName", e.target.value)}
          fullWidth
        />
        <Input
          label={t("master.company.bizNo")}
          placeholder="123-45-67890"
          value={formData.bizNo || ""}
          onChange={(e) => update("bizNo", e.target.value)}
          fullWidth
        />
        <Input
          label={t("master.company.ceoName")}
          placeholder={t("master.company.ceoName")}
          value={formData.ceoName || ""}
          onChange={(e) => update("ceoName", e.target.value)}
          fullWidth
        />
        <div className="col-span-2">
          <Input
            label={t("master.company.address")}
            placeholder={t("master.company.address")}
            value={formData.address || ""}
            onChange={(e) => update("address", e.target.value)}
            fullWidth
          />
        </div>
        <Input
          label={t("master.company.tel")}
          placeholder="+84-274-1234-567"
          value={formData.tel || ""}
          onChange={(e) => update("tel", e.target.value)}
          fullWidth
        />
        <Input
          label={t("master.company.fax")}
          placeholder="02-1234-5679"
          value={formData.fax || ""}
          onChange={(e) => update("fax", e.target.value)}
          fullWidth
        />
        <Input
          label={t("master.company.email")}
          placeholder="info@company.com"
          value={formData.email || ""}
          onChange={(e) => update("email", e.target.value)}
          fullWidth
        />
        <div />
        <div className="col-span-2">
          <Input
            label={t("common.remark")}
            placeholder={t("common.remarkPlaceholder")}
            value={formData.remark || ""}
            onChange={(e) => update("remark", e.target.value)}
            fullWidth
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? t("common.saving") : editingCompany ? t("common.edit") : t("common.add")}
        </Button>
      </div>
    </Modal>
  );
}

export default CompanyForm;
