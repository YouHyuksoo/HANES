"use client";

/**
 * @file src/pages/system/UserPage.tsx
 * @description 사용자 관리 페이지 - DataGrid 기반 CRUD + 사진 등록
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 사용자 목록 표시/정렬/페이지네이션
 * 2. **Modal**: 사용자 추가/수정 폼 (사진 업로드/크롭 포함)
 * 3. **ConfirmModal**: 삭제 확인 다이얼로그
 * 4. **ImageCropModal**: react-easy-crop을 사용한 사진 크롭
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, RefreshCw, Users, Camera, X, ZoomIn, ZoomOut, RotateCcw, Search } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, ConfirmModal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/services/api';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface User {
  id: string;
  email: string;
  name: string | null;
  empNo: string | null;
  dept: string | null;
  role: string;
  status: string;
  photoUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

// 이미지 크롭 모달
interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedImage: Blob) => void;
}

function ImageCropModal({ isOpen, onClose, imageSrc, onCropComplete }: ImageCropModalProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: { x: number; y: number }) => setCrop(crop);
  const onZoomChange = (zoom: number) => setZoom(zoom);
  const onCropAreaChange = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.putImageData(
      data,
      0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
      0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropComplete(croppedImage);
      onClose();
    } catch (error) {
      console.error('Crop failed:', error);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('system.users.photoCrop')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm}>
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative w-full h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropAreaChange={onCropAreaChange}
          />
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setZoom(Math.max(1, zoom - 0.1))}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-32"
          />
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.1))}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ml-4"
            title={t('system.users.rotate')}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** 사용자 아바타 (이미지 로드 실패 시 기본 아이콘 폴백) */
function UserAvatar({ photoUrl }: { photoUrl: string | null }) {
  const [imgError, setImgError] = useState(false);

  if (!photoUrl || imgError) {
    return (
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
        <Users className="w-5 h-5 text-primary" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
      <img
        src={photoUrl}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

function UserPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [search, setSearch] = useState('');

  // 이미지 크롭 관련 상태
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string>('');
  const [croppedImage, setCroppedImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setCroppedImage(null);
    setPreviewUrl('');
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
    setCroppedImage(null);
    setPreviewUrl(user.photoUrl || '');
    setIsModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError(t('system.users.photoTypeError'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError(t('system.users.photoSizeError'));
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
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    try {
      if (editingUser) {
        // 수정
        const data: Record<string, string> = {};
        if (formName !== (editingUser.name || '')) data.name = formName;
        if (formEmpNo !== (editingUser.empNo || '')) data.empNo = formEmpNo;
        if (formDept !== (editingUser.dept || '')) data.dept = formDept;
        if (formRole !== editingUser.role) data.role = formRole;
        if (formStatus !== editingUser.status) data.status = formStatus;
        if (formPassword) data.password = formPassword;

        // 일반 데이터 먼저 업데이트
        await api.patch(`/users/${editingUser.id}`, data);

        // 사진이 있으면 별도 업로드
        if (croppedImage) {
          const formData = new FormData();
          formData.append('photo', croppedImage, 'photo.jpg');
          await api.post(`/users/${editingUser.id}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }

        // 사진 삭제 요청
        if (editingUser.photoUrl && previewUrl === '' && !croppedImage) {
          await api.delete(`/users/${editingUser.id}/photo`);
        }
      } else {
        // 생성
        const res = await api.post('/users', {
          email: formEmail,
          password: formPassword || 'admin123',
          name: formName || undefined,
          empNo: formEmpNo || undefined,
          dept: formDept || undefined,
          role: formRole,
        });

        // 사진 업로드 (TransformInterceptor로 인해 data.data 구조 사용)
        const newUserId = res.data?.data?.id || res.data?.id;
        if (croppedImage && newUserId) {
          const formData = new FormData();
          formData.append('photo', croppedImage, 'photo.jpg');
          await api.post(`/users/${newUserId}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
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
      {
        accessorKey: 'photoUrl',
        header: t('system.users.photo'),
        size: 60,
        cell: ({ getValue }) => <UserAvatar photoUrl={getValue() as string | null} />,
      },
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
          <Button variant="secondary" size="sm" onClick={fetchUsers}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" /> {t('system.users.addUser')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <DataGrid
            data={users}
            columns={columns}
            isLoading={loading}
            emptyMessage={t('system.users.emptyMessage')}
            enableExport
            exportFileName={t('system.users.title')}
            toolbarLeft={
              <Input
                placeholder={t('system.users.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            }
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

          {/* 사진 업로드 영역 */}
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-primary/30">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-10 h-10 text-primary" />
                )}
              </div>
              {previewUrl && (
                <button
                  onClick={handleRemovePhoto}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-1" />
                {previewUrl ? t('system.users.changePhoto') : t('system.users.addPhoto')}
              </Button>
            </div>
            <p className="text-xs text-text-muted">{t('system.users.photoHint')}</p>
          </div>

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

      {/* 이미지 크롭 모달 */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={tempImageSrc}
        onCropComplete={handleCropComplete}
      />

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
