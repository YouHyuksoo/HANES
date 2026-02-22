"use client";

/**
 * @file src/pages/auth/LoginPage.tsx
 * @description 로그인/회원가입 페이지 - 좌측 브랜딩 + 우측 폼 레이아웃
 *
 * 초보자 가이드:
 * 1. **탭 전환**: 로그인/회원가입 폼 전환
 * 2. **useAuthStore**: Zustand 인증 스토어로 로그인/회원가입 처리
 * 3. **에러 표시**: API 에러 메시지를 폼 아래에 표시
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogIn, UserPlus, Factory } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input, Select } from '@/components/ui';
import { AxiosError } from 'axios';
import { api } from '@/services/api';
import LoginBranding from './components/LoginBranding';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';

interface CompanyOption {
  companyCode: string;
  companyName: string;
}

interface PlantOption {
  plantCode: string;
  plantName: string;
}

type TabType = 'login' | 'register';

function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, register, isLoading } = useAuthStore();
  const [tab, setTab] = useState<TabType>('login');
  const [error, setError] = useState('');

  // 회사 목록
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companyLoading, setCompanyLoading] = useState(true);

  // 사업장 목록
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [selectedPlant, setSelectedPlant] = useState('');
  const [plantLoading, setPlantLoading] = useState(false);

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 페이지 로드 시 활성 회사 목록 조회
  useEffect(() => {
    setCompanyLoading(true);
    api.get('/master/companies/public')
      .then((res) => {
        const list = res.data?.data || [];
        setCompanies(list);
        if (list.length > 0) setSelectedCompany(list[0].companyCode);
      })
      .catch(() => setCompanies([]))
      .finally(() => setCompanyLoading(false));
  }, []);

  // 회사 선택 시 해당 사업장 목록 조회
  useEffect(() => {
    if (!selectedCompany) {
      setPlants([]);
      setSelectedPlant('');
      return;
    }
    setPlantLoading(true);
    api.get(`/master/companies/public/plants?company=${selectedCompany}`)
      .then((res) => {
        const list = res.data?.data || [];
        setPlants(list);
        if (list.length > 0) setSelectedPlant(list[0].plantCode);
        else setSelectedPlant('');
      })
      .catch(() => {
        setPlants([]);
        setSelectedPlant('');
      })
      .finally(() => setPlantLoading(false));
  }, [selectedCompany]);

  // 회원가입 폼
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmpNo, setRegEmpNo] = useState('');
  const [regDept, setRegDept] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(loginEmail, loginPassword, selectedCompany, selectedPlant);
      router.replace('/dashboard');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setError(axiosErr.response?.data?.message || t('auth.loginFailed'));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register({
        email: regEmail,
        password: regPassword,
        name: regName || undefined,
        empNo: regEmpNo || undefined,
        dept: regDept || undefined,
      });
      router.replace('/dashboard');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setError(axiosErr.response?.data?.message || t('auth.registerFailed'));
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* 좌측 - 애니메이션 브랜딩 영역 */}
      <LoginBranding />

      {/* 우측 - 폼 영역 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* 모바일 로고 */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-text">HARNESS MES</h1>
          </div>

          {/* 탭 전환 + 언어 선택 */}
          <div className="flex items-center border-b border-border mb-8">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'login'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              {t('auth.login')}
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'register'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              {t('auth.register')}
            </button>
            <div className="ml-auto pb-2">
              <LanguageSwitcher />
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* 로그인 폼 */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-xl font-semibold text-text mb-2">{t('auth.loginTitle')}</h2>
              <p className="text-sm text-text-muted mb-6">{t('auth.loginDesc')}</p>

              <Select
                label={t('master.company.selectCompany')}
                options={companies.map((c) => ({ value: c.companyCode, label: `${c.companyName} (${c.companyCode})` }))}
                value={selectedCompany}
                onChange={setSelectedCompany}
                placeholder={companyLoading ? t('common.loading') : t('master.company.selectCompany')}
                fullWidth
              />

              <Select
                label={t('auth.plant')}
                options={plants.map((p) => ({ value: p.plantCode, label: `${p.plantName} (${p.plantCode})` }))}
                value={selectedPlant}
                onChange={setSelectedPlant}
                placeholder={plantLoading ? t('common.loading') : t('auth.selectPlant')}
                fullWidth
              />

              <Input
                label={t('auth.email')}
                type="email"
                placeholder="admin@harness.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                fullWidth
                required
              />
              <Input
                label={t('auth.password')}
                type="password"
                placeholder={t('auth.password')}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                fullWidth
                required
              />

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full mt-6"
              >
                {t('auth.login')}
              </Button>
            </form>
          )}

          {/* 회원가입 폼 */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-xl font-semibold text-text mb-2">{t('auth.registerTitle')}</h2>
              <p className="text-sm text-text-muted mb-6">{t('auth.registerDesc')}</p>

              <Input
                label={t('auth.emailRequired')}
                type="email"
                placeholder="user@harness.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                fullWidth
                required
              />
              <Input
                label={t('auth.passwordRequired')}
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                fullWidth
                required
              />
              <Input
                label={t('auth.name')}
                placeholder={t('auth.name')}
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                fullWidth
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('auth.empNo')}
                  placeholder="EMP001"
                  value={regEmpNo}
                  onChange={(e) => setRegEmpNo(e.target.value)}
                  fullWidth
                />
                <Input
                  label={t('auth.dept')}
                  placeholder="생산팀"
                  value={regDept}
                  onChange={(e) => setRegDept(e.target.value)}
                  fullWidth
                />
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full mt-6"
              >
                {t('auth.register')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
