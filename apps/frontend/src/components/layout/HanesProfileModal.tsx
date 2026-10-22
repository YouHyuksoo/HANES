"use client";

/**
 * @file src/components/layout/HanesProfileModal.tsx
 * @description 사용자 메뉴 > 내 정보 모달 (HANES 전용: 사번·부서·회사/사업장).
 * 앱 틀은 @jisheng/ui AppShell 이고, 이 모달은 MainLayout 이 overlays 로 넘긴다.
 */
import { useTranslation } from "react-i18next";
import { User, Building, BadgeCheck, Building2, Mail } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import Modal from "@/components/ui/Modal";

export default function HanesProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { user, selectedCompany, selectedPlant } = useAuthStore();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('header.profile')}
      size="md"
    >
      <div className="flex flex-col items-center py-6">
        {/* Profile Image */}
        <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4">
          <User className="w-12 h-12 text-primary" />
        </div>

        {/* User Name */}
        <h3 className="text-xl font-semibold text-text mb-1">
          {user?.name || user?.email || t('common.user')}
        </h3>

        {/* Role Badge */}
        {user?.role && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full mb-6">
            <BadgeCheck className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-medium text-primary">{user.role}</span>
          </div>
        )}

        {/* User Info Grid */}
        <div className="w-full grid grid-cols-1 gap-3 mt-2">
          {user?.email && (
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('auth.email')}</p>
                <p className="text-sm font-medium text-text">{user.email}</p>
              </div>
            </div>
          )}

          {user?.empNo && (
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <BadgeCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('auth.empNo')}</p>
                <p className="text-sm font-medium text-text">{user.empNo}</p>
              </div>
            </div>
          )}

          {user?.dept && (
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('auth.dept')}</p>
                <p className="text-sm font-medium text-text">{user.dept}</p>
              </div>
            </div>
          )}

          {selectedCompany && (
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Building className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('menu.master.company')}</p>
                <p className="text-sm font-medium text-text">
                  {selectedCompany}{selectedPlant ? ` / ${selectedPlant}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
