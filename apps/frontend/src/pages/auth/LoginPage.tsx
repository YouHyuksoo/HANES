/**
 * @file src/pages/auth/LoginPage.tsx
 * @description 로그인/회원가입 페이지 - 좌측 브랜딩 + 우측 폼 레이아웃
 *
 * 초보자 가이드:
 * 1. **탭 전환**: 로그인/회원가입 폼 전환
 * 2. **useAuthStore**: Zustand 인증 스토어로 로그인/회원가입 처리
 * 3. **에러 표시**: API 에러 메시지를 폼 아래에 표시
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Factory } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';
import { AxiosError } from 'axios';

type TabType = 'login' | 'register';

function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuthStore();
  const [tab, setTab] = useState<TabType>('login');
  const [error, setError] = useState('');

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

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
      await login(loginEmail, loginPassword);
      navigate('/', { replace: true });
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setError(axiosErr.response?.data?.message || '로그인에 실패했습니다.');
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
      navigate('/', { replace: true });
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      setError(axiosErr.response?.data?.message || '회원가입에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* 좌측 - 브랜딩 영역 */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative flex-col justify-center items-center p-12">
        <div className="text-center text-white">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Factory className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">HANES MES</h1>
          <p className="text-lg text-white/80 max-w-md">
            Manufacturing Execution System
          </p>
          <p className="text-sm text-white/60 mt-2">
            생산 현장의 실시간 관리 솔루션
          </p>
        </div>
        {/* 배경 장식 */}
        <div className="absolute top-10 left-10 w-32 h-32 border border-white/10 rounded-full" />
        <div className="absolute bottom-20 right-10 w-48 h-48 border border-white/10 rounded-full" />
        <div className="absolute top-1/3 right-20 w-16 h-16 bg-white/5 rounded-lg rotate-45" />
      </div>

      {/* 우측 - 폼 영역 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* 모바일 로고 */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-text">HANES MES</h1>
          </div>

          {/* 탭 전환 */}
          <div className="flex border-b border-border mb-8">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'login'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              로그인
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
              회원가입
            </button>
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
              <h2 className="text-xl font-semibold text-text mb-2">로그인</h2>
              <p className="text-sm text-text-muted mb-6">이메일과 비밀번호를 입력하세요.</p>

              <Input
                label="이메일"
                type="email"
                placeholder="admin@hanes.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                fullWidth
                required
              />
              <Input
                label="비밀번호"
                type="password"
                placeholder="비밀번호"
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
                로그인
              </Button>
            </form>
          )}

          {/* 회원가입 폼 */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-xl font-semibold text-text mb-2">회원가입</h2>
              <p className="text-sm text-text-muted mb-6">새 계정을 만들어주세요.</p>

              <Input
                label="이메일 *"
                type="email"
                placeholder="user@hanes.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                fullWidth
                required
              />
              <Input
                label="비밀번호 *"
                type="password"
                placeholder="4자 이상"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                fullWidth
                required
              />
              <Input
                label="이름"
                placeholder="홍길동"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                fullWidth
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="사원번호"
                  placeholder="EMP001"
                  value={regEmpNo}
                  onChange={(e) => setRegEmpNo(e.target.value)}
                  fullWidth
                />
                <Input
                  label="부서"
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
                회원가입
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
