"use client";

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
import { useTranslation } from 'react-i18next';
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
  lastLoginAt: string | null;
  createdAt: string;
}

function UserPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [search, setSearch] = useState('');

  const roleOptions = useMemo(() => [
    { value: 'ADMIN', label: t('system.users.roleAdmin') },
    { value: 'MANAGER', label: t('system.users.roleManager') },
    { value: 'OPERATOR', label: t('system.users.roleOperator') },
    { value: 'VIEWER', label: t('system.users.roleViewer') },
  ], [t]);

  const statusOptions = useMemo(() => [
    { value: 'ACTIVE', label: t('system.users.statusActive') },
    { value: 'INACTIVE', label: t('system.users.statusInactive') },
  ], [t]);

  const roleLabel: Record<string, string> = useMemo(() => ({
    ADMIN: t('system.users.roleAdmin'),
    MANAGER: t('system.users.roleManager'),
    OPERATOR: t('system.users.roleOperator'),
    VIEWER: t('system.users.roleViewer'),
  }), [t]);

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
      const result = res.data?.data ?? res.data;
      setUsers(Array.isArray(result) ? result : []);
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
      setFormError(error.response?.data?.message || t('common.saveFailed'));
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
      { accessorKey: 'email', header: t('system.users.email'), size: 200 },
      { accessorKey: 'name', header: t('system.users.name'), size: 100 },
      { accessorKey: 'empNo', header: t('system.users.empNo'), size: 100 },
      { accessorKey: 'dept', header: t('system.users.dept'), size: 100 },
      {
        accessorKey: 'role',
        header: t('system.users.role'),
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
        header: t('system.users.status'),
        size: 80,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${
              status === 'ACTIVE'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {status === 'ACTIVE' ? t('system.users.statusActive') : t('system.users.statusInactive')}
            </span>
          );
        },
      },
      {
        accessorKey: 'lastLoginAt',
        header: t('system.users.lastLogin'),
        size: 150,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? new Date(v).toLocaleString('ko-KR') : '-';
        },
      },
      {
        id: 'actions',
        header: t('common.actions'),
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
    [t, roleLabel]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            {t('system.users.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('system.users.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t('system.users.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button variant="secondary" size="sm" onClick={fetchUsers}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" /> {t('system.users.addUser')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title={t('system.users.userList')}
          subtitle={t('system.users.totalCount', { count: users.length })}
        />
        <CardContent>
          <DataGrid
            data={users}
            columns={columns}
            pageSize={15}
            isLoading={loading}
            emptyMessage={t('system.users.emptyMessage')}
          />
        </CardContent>
      </Card>

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? t('system.users.editUser') : t('system.users.addUser')}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}
          <Input
            label={t('system.users.email')}
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            disabled={!!editingUser}
            fullWidth
            required
          />
          <Input
            label={editingUser ? t('system.users.passwordEdit') : t('system.users.password')}
            type="password"
            placeholder={editingUser ? t('system.users.passwordEditPlaceholder') : t('auth.passwordPlaceholder')}
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            fullWidth
            required={!editingUser}
          />
          <Input
            label={t('system.users.name')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            fullWidth
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('system.users.empNo')}
              value={formEmpNo}
              onChange={(e) => setFormEmpNo(e.target.value)}
              fullWidth
            />
            <Input
              label={t('system.users.dept')}
              value={formDept}
              onChange={(e) => setFormDept(e.target.value)}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('system.users.role')}
              value={formRole}
              onChange={(value) => setFormRole(value)}
              options={roleOptions}
              fullWidth
            />
            {editingUser && (
              <Select
                label={t('system.users.status')}
                value={formStatus}
                onChange={(value) => setFormStatus(value)}
                options={statusOptions}
                fullWidth
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              {editingUser ? t('common.edit') : t('common.add')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('system.users.deleteUser')}
        message={t('system.users.deleteConfirm', { name: deleteTarget?.name || deleteTarget?.email })}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  );
}

export default UserPage;
