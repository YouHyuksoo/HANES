/**
 * @file src/pages/system/UserPage.tsx
 * @description 사용자 관리 페이지 - DataGrid 기반 CRUD
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 사용자 목록 표시/정렬/페이지네이션
 * 2. **Modal**: 사용자 추가/수정 폼
 * 3. **ConfirmModal**: 삭제 확인 다이얼로그
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Users } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal, ConfirmModal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/services/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  empNo: string | null;
  dept: string | null;
  role: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
}

const roleOptions = [
  { value: 'ADMIN', label: '관리자' },
  { value: 'MANAGER', label: '매니저' },
  { value: 'OPERATOR', label: '작업자' },
  { value: 'VIEWER', label: '조회자' },
];

const statusOptions = [
  { value: 'ACTIVE', label: '활성' },
  { value: 'INACTIVE', label: '비활성' },
];

const roleLabel: Record<string, string> = {
  ADMIN: '관리자',
  MANAGER: '매니저',
  OPERATOR: '작업자',
  VIEWER: '조회자',
};

function UserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [search, setSearch] = useState('');

  // 폼 상태
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmpNo, setFormEmpNo] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formRole, setFormRole] = useState('OPERATOR');
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [formError, setFormError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { search: search || undefined } });
      setUsers(res.data);
    } catch {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormPassword('');
    setFormName('');
    setFormEmpNo('');
    setFormDept('');
    setFormRole('OPERATOR');
    setFormStatus('ACTIVE');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormPassword('');
    setFormName(user.name || '');
    setFormEmpNo(user.empNo || '');
    setFormDept(user.dept || '');
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    setFormError('');
    try {
      if (editingUser) {
        const data: Record<string, string> = {};
        if (formName !== (editingUser.name || '')) data.name = formName;
        if (formEmpNo !== (editingUser.empNo || '')) data.empNo = formEmpNo;
        if (formDept !== (editingUser.dept || '')) data.dept = formDept;
        if (formRole !== editingUser.role) data.role = formRole;
        if (formStatus !== editingUser.status) data.status = formStatus;
        if (formPassword) data.password = formPassword;
        await api.patch(`/users/${editingUser.id}`, data);
      } else {
        await api.post('/users', {
          email: formEmail,
          password: formPassword || 'admin123',
          name: formName || undefined,
          empNo: formEmpNo || undefined,
          dept: formDept || undefined,
          role: formRole,
        });
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormError(error.response?.data?.message || '저장에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      // 에러 무시
    }
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { accessorKey: 'email', header: '이메일', size: 200 },
      { accessorKey: 'name', header: '이름', size: 100 },
      { accessorKey: 'empNo', header: '사원번호', size: 100 },
      { accessorKey: 'dept', header: '부서', size: 100 },
      {
        accessorKey: 'role',
        header: '역할',
        size: 90,
        cell: ({ getValue }) => {
          const role = getValue() as string;
          const colorMap: Record<string, string> = {
            ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
            MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
            OPERATOR: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
            VIEWER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
          };
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${colorMap[role] || ''}`}>
              {roleLabel[role] || role}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: '상태',
        size: 80,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${
              status === 'ACTIVE'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {status === 'ACTIVE' ? '활성' : '비활성'}
            </span>
          );
        },
      },
      {
        accessorKey: 'lastLogin',
        header: '최근 로그인',
        size: 150,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? new Date(v).toLocaleString('ko-KR') : '-';
        },
      },
      {
        id: 'actions',
        header: '관리',
        size: 100,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => openEditModal(row.original)}
              className="p-1 hover:bg-surface rounded"
            >
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button
              onClick={() => setDeleteTarget(row.original)}
              className="p-1 hover:bg-surface rounded"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            사용자 관리
          </h1>
          <p className="text-text-muted mt-1">시스템 사용자를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="이름/이메일 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button variant="secondary" size="sm" onClick={fetchUsers}>
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" /> 사용자 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title="사용자 목록"
          subtitle={`총 ${users.length}명`}
        />
        <CardContent>
          <DataGrid
            data={users}
            columns={columns}
            pageSize={15}
            isLoading={loading}
            emptyMessage="등록된 사용자가 없습니다."
          />
        </CardContent>
      </Card>

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? '사용자 수정' : '사용자 추가'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}
          <Input
            label="이메일"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            disabled={!!editingUser}
            fullWidth
            required
          />
          <Input
            label={editingUser ? '비밀번호 (변경 시에만 입력)' : '비밀번호'}
            type="password"
            placeholder={editingUser ? '변경하지 않으면 비워두세요' : '4자 이상'}
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            fullWidth
            required={!editingUser}
          />
          <Input
            label="이름"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            fullWidth
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="사원번호"
              value={formEmpNo}
              onChange={(e) => setFormEmpNo(e.target.value)}
              fullWidth
            />
            <Input
              label="부서"
              value={formDept}
              onChange={(e) => setFormDept(e.target.value)}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="역할"
              value={formRole}
              onChange={(value) => setFormRole(value)}
              options={roleOptions}
              fullWidth
            />
            {editingUser && (
              <Select
                label="상태"
                value={formStatus}
                onChange={(value) => setFormStatus(value)}
                options={statusOptions}
                fullWidth
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSubmit}>
              {editingUser ? '수정' : '추가'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="사용자 삭제"
        message={`${deleteTarget?.name || deleteTarget?.email} 사용자를 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
      />
    </div>
  );
}

export default UserPage;
