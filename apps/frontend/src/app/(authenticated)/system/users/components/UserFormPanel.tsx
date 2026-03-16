/**
 * @file src/app/(authenticated)/system/users/components/UserFormPanel.tsx
 * @description 사용자 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **사진 업로드**: 상단에 사진 크롭/업로드 영역
 * 3. **API**: POST /users (생성), PATCH /users/:id (수정)
 */

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Users, Camera, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { DepartmentSelect } from "@/components/shared";
import { api } from "@/services/api";
import ImageCropModal from "./ImageCropModal";

interface User {
  id: string;
  email: string;
  name: string | null;
  empNo: string | null;
  dept: string | null;
  role: string;
  status: string;
  photoUrl: string | null;
  pdaRoleCode: string | null;
}

interface PdaRoleOption {
  code: string;
  name: string;
}

interface Props {
  editingUser: User | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function UserFormPanel({ editingUser, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingUser;

  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmpNo, setFormEmpNo] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formRole, setFormRole] = useState("OPERATOR");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formPdaRoleCode, setFormPdaRoleCode] = useState("");
  const [pdaRoleOptions, setPdaRoleOptions] = useState<PdaRoleOption[]>([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState("");
  const [croppedImage, setCroppedImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roleOptions = useMemo(() => [
    { value: "ADMIN", label: t("system.users.roleAdmin") },
    { value: "MANAGER", label: t("system.users.roleManager") },
    { value: "OPERATOR", label: t("system.users.roleOperator") },
    { value: "VIEWER", label: t("system.users.roleViewer") },
  ], [t]);

  const statusOptions = useMemo(() => [
    { value: "ACTIVE", label: t("system.users.statusActive") },
    { value: "INACTIVE", label: t("system.users.statusInactive") },
  ], [t]);

  useEffect(() => {
    setFormEmail(editingUser?.email ?? "");
    setFormPassword("");
    setFormName(editingUser?.name ?? "");
    setFormEmpNo(editingUser?.empNo ?? "");
    setFormDept(editingUser?.dept ?? "");
    setFormRole(editingUser?.role ?? "OPERATOR");
    setFormStatus(editingUser?.status ?? "ACTIVE");
    setFormPdaRoleCode(editingUser?.pdaRoleCode ?? "");
    setFormError("");
    setCroppedImage(null);
    setPreviewUrl(editingUser?.photoUrl ?? "");
  }, [editingUser]);

  useEffect(() => {
    api.get("/system/pda-roles/active")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setPdaRoleOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => setPdaRoleOptions([]));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError(t("system.users.photoTypeError"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError(t("system.users.photoSizeError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (blob: Blob) => {
    setCroppedImage(blob);
    setPreviewUrl(URL.createObjectURL(blob));
  };

  const handleRemovePhoto = () => {
    setCroppedImage(null);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    setFormError("");
    setSaving(true);
    try {
      if (isEdit && editingUser) {
        const data: Record<string, string | null> = {};
        if (formName !== (editingUser.name || "")) data.name = formName;
        if (formEmpNo !== (editingUser.empNo || "")) data.empNo = formEmpNo;
        if (formDept !== (editingUser.dept || "")) data.dept = formDept;
        if (formRole !== editingUser.role) data.role = formRole;
        if (formStatus !== editingUser.status) data.status = formStatus;
        if (formPassword) data.password = formPassword;
        if (formPdaRoleCode !== (editingUser.pdaRoleCode || ""))
          data.pdaRoleCode = formPdaRoleCode || null;

        await api.patch(`/users/${editingUser.id}`, data);

        if (croppedImage) {
          const formData = new FormData();
          formData.append("photo", croppedImage, "photo.jpg");
          await api.post(`/users/${editingUser.id}/photo`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
        if (editingUser.photoUrl && previewUrl === "" && !croppedImage) {
          await api.delete(`/users/${editingUser.id}/photo`);
        }
      } else {
        const res = await api.post("/users", {
          email: formEmail,
          password: formPassword || "admin123",
          name: formName || undefined,
          empNo: formEmpNo || undefined,
          dept: formDept || undefined,
          role: formRole,
          pdaRoleCode: formPdaRoleCode || undefined,
        });
        const newUserId = res.data?.data?.id || res.data?.id;
        if (croppedImage && newUserId) {
          const formData = new FormData();
          formData.append("photo", croppedImage, "photo.jpg");
          await api.post(`/users/${newUserId}/photo`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      }
      onSave();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormError(error.response?.data?.message || t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
        {/* 헤더 */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold text-text">
            {isEdit ? t("system.users.editUser") : t("system.users.addUser")}
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || (!isEdit && !formEmail.trim())}>
              {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
            </Button>
          </div>
        </div>

        {/* 폼 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {formError && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          {/* 사진 영역 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-primary/30">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-primary" />
                )}
              </div>
              {previewUrl && (
                <button onClick={handleRemovePhoto} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Camera className="w-3 h-3 mr-1" />
              {previewUrl ? t("system.users.changePhoto") : t("system.users.addPhoto")}
            </Button>
            <p className="text-[10px] text-text-muted">{t("system.users.photoHint")}</p>
          </div>

          {/* 계정정보 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("system.users.sectionAccount", "계정정보")}</h3>
            <div className="space-y-3">
              <Input label={t("system.users.email")} type="email" value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)} disabled={isEdit} fullWidth required />
              <Input label={isEdit ? t("system.users.passwordEdit") : t("system.users.password")} type="password"
                placeholder={isEdit ? t("system.users.passwordEditPlaceholder") : t("auth.passwordPlaceholder")}
                value={formPassword} onChange={(e) => setFormPassword(e.target.value)} fullWidth required={!isEdit} />
            </div>
          </div>

          {/* 기본정보 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("system.users.sectionBasic", "기본정보")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("system.users.name")} value={formName}
                onChange={(e) => setFormName(e.target.value)} fullWidth />
              <Input label={t("system.users.empNo")} value={formEmpNo}
                onChange={(e) => setFormEmpNo(e.target.value)} fullWidth />
              <DepartmentSelect label={t("system.users.dept")} value={formDept}
                onChange={(v) => setFormDept(v)} fullWidth />
              <Select label={t("system.users.role")} value={formRole}
                onChange={(v) => setFormRole(v)} options={roleOptions} fullWidth />
            </div>
          </div>

          {/* 추가설정 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("system.users.sectionExtra", "추가설정")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {isEdit && (
                <Select label={t("system.users.status")} value={formStatus}
                  onChange={(v) => setFormStatus(v)} options={statusOptions} fullWidth />
              )}
              <Select label={t("system.users.pdaRole")} value={formPdaRoleCode}
                onChange={(v) => setFormPdaRoleCode(v)}
                options={[
                  { value: "", label: t("system.users.pdaRoleNone") },
                  ...pdaRoleOptions.map((r) => ({ value: r.code, label: r.name })),
                ]}
                fullWidth />
            </div>
          </div>
        </div>
      </div>

      {/* 이미지 크롭 모달 */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={tempImageSrc}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
