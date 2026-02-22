"use client";

/**
 * @file master/code/page.tsx
 * @description 공통코드 관리 페이지 - 실제 API 연동
 *
 * 초보자 가이드:
 * 1. **좌측**: 그룹 코드 목록 (GET /master/com-codes/groups)
 * 2. **우측**: 선택된 그룹의 상세 코드 (GET /master/com-codes/groups/:groupCode)
 * 3. **CRUD**: 추가/수정/삭제 모두 API 통해 처리
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Settings } from "lucide-react";
import { Button, ConfirmModal } from "@/components/ui";
import { useApiQuery, useApiMutation, useInvalidateQueries } from "@/hooks/useApi";
import GroupList from "./components/GroupList";
import CodeDetailGrid from "./components/CodeDetailGrid";
import CodeFormModal from "./components/CodeFormModal";
import type { ComCodeGroup, ComCodeDetail, ComCodeFormData } from "./types";

function ComCodePage() {
  const { t } = useTranslation();
  const invalidate = useInvalidateQueries();

  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<ComCodeDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ComCodeDetail | null>(null);

  /* ── 그룹 목록 조회 ── */
  const { data: groupsData, isLoading: groupsLoading } = useApiQuery<ComCodeGroup[]>(
    ["com-codes", "groups"],
    "/master/com-codes/groups",
  );
  const groups = groupsData?.data ?? [];

  /* ── 선택된 그룹의 상세 코드 조회 ── */
  const { data: codesData, isLoading: codesLoading } = useApiQuery<ComCodeDetail[]>(
    ["com-codes", "detail", selectedGroup],
    `/master/com-codes/groups/${selectedGroup}`,
    { enabled: !!selectedGroup },
  );
  const codes = codesData?.data ?? [];

  /* ── 첫 로드 시 첫 그룹 자동 선택 ── */
  if (!selectedGroup && groups.length > 0) {
    setSelectedGroup(groups[0].groupCode);
  }

  /* ── 생성 mutation ── */
  const createMutation = useApiMutation<ComCodeDetail, ComCodeFormData>(
    "/master/com-codes",
    "post",
    {
      onSuccess: () => {
        invalidate(["com-codes"]);
        setIsModalOpen(false);
      },
    },
  );

  /* ── 수정 mutation ── */
  const updateMutation = useApiMutation<ComCodeDetail, ComCodeFormData>(
    editingCode ? `/master/com-codes/${editingCode.id}` : "/master/com-codes",
    "put",
    {
      onSuccess: () => {
        invalidate(["com-codes"]);
        setIsModalOpen(false);
        setEditingCode(null);
      },
    },
  );

  /* ── 삭제 mutation ── */
  const deleteMutation = useApiMutation<void, void>(
    deleteTarget ? `/master/com-codes/${deleteTarget.id}` : "/master/com-codes",
    "delete",
    {
      onSuccess: () => {
        invalidate(["com-codes"]);
        setDeleteTarget(null);
      },
    },
  );

  /* ── 핸들러 ── */
  const handleSubmit = useCallback(
    (data: ComCodeFormData) => {
      if (editingCode) {
        updateMutation.mutate(data);
      } else {
        createMutation.mutate(data);
      }
    },
    [editingCode, createMutation, updateMutation],
  );

  const handleEdit = useCallback((code: ComCodeDetail) => {
    setEditingCode(code);
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback((code: ComCodeDetail) => {
    setDeleteTarget(code);
  }, []);

  const handleRefresh = useCallback(() => {
    invalidate(["com-codes"]);
  }, [invalidate]);

  return (
    <div className="flex flex-col animate-fade-in h-[calc(100vh-var(--header-height)-var(--tab-bar-height)-48px)]">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Settings className="w-7 h-7 text-primary" />
            {t("master.code.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.code.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingCode(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> {t("master.code.addCode")}
          </Button>
        </div>
      </div>

      {/* 본문: 좌측 그룹 + 우측 상세 */}
      <div className="grid grid-cols-12 gap-6 min-h-0 flex-1">
        <div className="col-span-3 flex flex-col min-h-0">
          <GroupList
            groups={groups}
            selectedGroup={selectedGroup}
            onSelect={setSelectedGroup}
            isLoading={groupsLoading}
          />
        </div>
        <div className="col-span-9 flex flex-col min-h-0">
          <CodeDetailGrid
            groupCode={selectedGroup}
            codes={codes}
            isLoading={codesLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* 추가/수정 모달 */}
      <CodeFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCode(null);
        }}
        onSubmit={handleSubmit}
        editingCode={editingCode}
        selectedGroup={selectedGroup}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(undefined as never)}
        title={t("common.deleteConfirm", { defaultValue: "삭제 확인" })}
        message={`${deleteTarget?.groupCode}.${deleteTarget?.detailCode} (${deleteTarget?.codeName}) ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        confirmText={t("common.delete")}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

export default ComCodePage;
