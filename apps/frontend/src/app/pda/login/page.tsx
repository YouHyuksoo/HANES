"use client";

/**
 * @file src/app/pda/login/page.tsx
 * @description PDA 전용 로그인 페이지 - 모바일 최적화, 컴팩트 폼
 *
 * 초보자 가이드:
 * 1. PC 로그인과 동일 API 사용, UI만 PDA(모바일)에 맞게 축소
 * 2. 좌측 브랜딩 패널 없음 → 전체 화면이 폼 영역
 * 3. 회원가입 없음 (PDA에서는 로그인만 제공)
 * 4. 로그인 성공 → /pda/menu 이동
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Smartphone, Monitor } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button, Input, Select } from "@/components/ui";
import { AxiosError } from "axios";
import { api } from "@/services/api";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

interface CompanyOption {
  companyCode: string;
  companyName: string;
}

interface PlantOption {
  plantCode: string;
  plantName: string;
}

export default function PdaLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState("");

  // 회사/사업장
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companyLoading, setCompanyLoading] = useState(true);
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [selectedPlant, setSelectedPlant] = useState("");
  const [plantLoading, setPlantLoading] = useState(false);

  // 폼
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 회사 목록 로드
  useEffect(() => {
    setCompanyLoading(true);
    api
      .get("/master/companies/public")
      .then((res) => {
        const list = res.data?.data || [];
        setCompanies(list);
        if (list.length > 0) setSelectedCompany(list[0].companyCode);
      })
      .catch(() => setCompanies([]))
      .finally(() => setCompanyLoading(false));
  }, []);

  // 사업장 목록 로드
  useEffect(() => {
    if (!selectedCompany) {
      setPlants([]);
      setSelectedPlant("");
      return;
    }
    setPlantLoading(true);
    api
      .get(`/master/companies/public/plants?company=${selectedCompany}`)
      .then((res) => {
        const list = res.data?.data || [];
        setPlants(list);
        if (list.length > 0) setSelectedPlant(list[0].plantCode);
        else setSelectedPlant("");
      })
      .catch(() => {
        setPlants([]);
        setSelectedPlant("");
      })
      .finally(() => setPlantLoading(false));
  }, [selectedCompany]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      try {
        await login(email, password, selectedCompany, selectedPlant);
        router.replace("/pda/menu");
      } catch (err) {
        const axiosErr = err as AxiosError<{ message: string }>;
        setError(axiosErr.response?.data?.message || t("auth.loginFailed"));
      }
    },
    [email, password, selectedCompany, selectedPlant, login, router, t],
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            HARNESS PDA
          </span>
        </div>
        <LanguageSwitcher />
      </div>

      {/* 폼 영역 */}
      <div className="flex-1 flex items-center justify-center px-5 py-6">
        <div className="w-full max-w-sm">
          {/* 타이틀 */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t("auth.loginTitle")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("auth.loginDesc")}
            </p>
          </div>

          {/* 에러 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* 로그인 폼 */}
          <form onSubmit={handleLogin} className="space-y-3">
            <Select
              label={t("master.company.selectCompany")}
              options={companies.map((c) => ({
                value: c.companyCode,
                label: `${c.companyName} (${c.companyCode})`,
              }))}
              value={selectedCompany}
              onChange={setSelectedCompany}
              placeholder={
                companyLoading
                  ? t("common.loading")
                  : t("master.company.selectCompany")
              }
              fullWidth
            />

            <Select
              label={t("auth.plant")}
              options={plants.map((p) => ({
                value: p.plantCode,
                label: `${p.plantName} (${p.plantCode})`,
              }))}
              value={selectedPlant}
              onChange={setSelectedPlant}
              placeholder={
                plantLoading ? t("common.loading") : t("auth.selectPlant")
              }
              fullWidth
            />

            <Input
              label={t("auth.email")}
              type="email"
              placeholder="admin@harness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />

            <Input
              label={t("auth.password")}
              type="password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-4 h-12 text-base"
            >
              <Smartphone className="w-4 h-4" />
              {t("auth.pdaLogin")}
            </Button>
          </form>

          {/* PC MES 전환 링크 */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
            >
              <Monitor className="w-4 h-4" />
              {t("auth.pcLogin")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
