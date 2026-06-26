"use client";

/**
 * @file src/app/(authenticated)/master/label/components/TemplateManager.tsx
 * @description 라벨 템플릿 저장/불러오기 UI - DB 연동 CRUD
 *
 * 초보자 가이드:
 * 1. **저장**: 현재 디자인에 이름을 붙여 DB에 저장
 * 2. **불러오기**: 목록에서 선택하면 디자인 설정 복원
 * 3. **삭제**: 불필요한 템플릿 삭제
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Save, FolderOpen, Trash2, Star, FilePlus2 } from "lucide-react";
import { Button, ConfirmModal } from "@/components/ui";
import { LabelDesign, LabelCategory } from "../types";
import { useLabelTemplates, LabelTemplateItem } from "../hooks/useLabelTemplates";
import { Field } from "./LabelFieldHelp";

interface TemplateManagerProps {
  category: LabelCategory;
  design: LabelDesign;
  onLoad: (design: LabelDesign) => void;
  /** 새 디자인(빈/기본 캔버스)으로 새 작업 시작 */
  onNew?: () => void;
  /** 현재 디자인에 미저장 변경이 있는지 — true면 템플릿 로드 전 경고 */
  isDirty?: boolean;
  /** 저장/덮어쓰기 성공 시 호출(상위 dirty 기준선 갱신) */
  onSaved?: () => void;
}

export default function TemplateManager({ category, design, onLoad, onNew, isDirty = false, onSaved }: TemplateManagerProps) {
  const { t } = useTranslation();
  const { templates, loading, fetchedCategory, fetchList, save, update, remove } = useLabelTemplates();
  const [saveName, setSaveName] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabelTemplateItem | null>(null);
  const [pendingLoad, setPendingLoad] = useState<LabelTemplateItem | null>(null);
  const [showSave, setShowSave] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 카테고리(소스)별로 1회 자동 로드 — 진입/소스 전환 시 해당 카테고리와 캔버스를 동기화
  const loadedCategoriesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchList(category);
  }, [category, fetchList]);

  /** 실제 로드 수행(경고 통과 후) */
  const doLoad = useCallback((tpl: LabelTemplateItem) => {
    setSelectedTemplateKey(tpl.templateKey);
    onLoad(tpl.designData);
  }, [onLoad]);

  // 진입/소스 전환 시 해당 카테고리의 저장 라벨(기본 우선, 없으면 최근)을 캔버스에 자동 로드.
  // 저장된 라벨이 없으면 해당 카테고리의 기본 디자인으로 새 작업을 시작해 목록과 싱크를 맞춘다.
  useEffect(() => {
    if (loading) return;
    // 현재 카테고리의 목록 조회가 끝나기 전(templates가 이전 카테고리 잔존)에는 자동 로드하지 않는다.
    if (fetchedCategory !== category) return;
    if (loadedCategoriesRef.current.has(category)) return;
    loadedCategoriesRef.current.add(category);
    if (templates.length > 0) {
      const target = templates.find((tpl) => tpl.isDefault) ?? templates[0];
      doLoad(target);
    } else {
      setSelectedTemplateKey(null);
      onNew?.();
    }
  }, [templates, loading, fetchedCategory, category, doLoad, onNew]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    try {
      await save(saveName.trim(), category, design);
      setSaveName("");
      setShowSave(false);
      onSaved?.();
      fetchList(category);
    } catch {
      // 중복명 등 에러 시 무시 (toast 추가 가능)
    }
  };

  const handleCancelSave = () => {
    setShowSave(false);
    setSaveName("");
  };

  const handleOverwrite = async (tpl: LabelTemplateItem) => {
    await update(tpl.templateKey, design);
    onSaved?.();
    fetchList(category);
  };

  const handleLoad = (tpl: LabelTemplateItem) => {
    // 이미 선택된 템플릿 재클릭은 그대로 로드. 미저장 변경이 있으면 경고 후 로드.
    if (isDirty && tpl.templateKey !== selectedTemplateKey) {
      setPendingLoad(tpl);
      return;
    }
    doLoad(tpl);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.templateKey);
    if (selectedTemplateKey === deleteTarget.templateKey) setSelectedTemplateKey(null);
    setDeleteTarget(null);
    fetchList(category);
  };

  return (
    <>
    <div className="space-y-3">
      {/* 헤더 + 새 저장 토글 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-text flex items-center gap-1.5 whitespace-nowrap">
          <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          {t("master.label.templateList")}
        </h4>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 justify-center whitespace-nowrap"
            onClick={() => { setSelectedTemplateKey(null); onNew?.(); }}
            title={t("master.label.newDesignHint", "현재 카테고리의 빈 디자인으로 새 작업을 시작합니다")}
          >
            <FilePlus2 className="w-3.5 h-3.5 mr-1 shrink-0" />
            {t("master.label.newDesign", "새 디자인")}
          </Button>
          <Button
            size="sm"
            variant={showSave ? "secondary" : "primary"}
            className="flex-1 justify-center whitespace-nowrap"
            onClick={() => { setShowSave(!showSave); setTimeout(() => inputRef.current?.focus(), 50); }}
          >
            <Save className="w-3.5 h-3.5 mr-1 shrink-0" />
            {t("master.label.saveNew")}
          </Button>
        </div>
      </div>

      {/* 새 저장 입력 */}
      {showSave && (
        <div className="space-y-2">
          <Field field="templateName" label={t("master.label.templateName", "템플릿 이름")} required>
            <input
              ref={inputRef}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={t("master.label.templateNamePlaceholder", "템플릿 이름")}
              className="w-full px-2 py-1.5 text-sm rounded border border-border bg-surface text-text focus:border-primary focus:outline-none"
            />
          </Field>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" onClick={handleCancelSave}>
              {t("common.cancel", "취소")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>
              {t("master.label.save")}
            </Button>
          </div>
        </div>
      )}

      {/* 템플릿 목록 */}
      <div className="space-y-1 max-h-[200px] overflow-auto">
        {loading && <p className="text-xs text-text-muted py-2 text-center">{t("common.loading")}</p>}
        {!loading && templates.length === 0 && (
          <p className="text-xs text-text-muted py-4 text-center">{t("master.label.noTemplates")}</p>
        )}
        {templates.map((tpl) => (
          <div
            key={tpl.templateKey}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
              selectedTemplateKey === tpl.templateKey
                ? "bg-primary/10 border border-primary/30"
                : "bg-surface hover:bg-primary/5 border border-transparent"
            }`}
            onClick={() => handleLoad(tpl)}
          >
            {tpl.isDefault && <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />}
            <span className="flex-1 truncate text-text">{tpl.templateName}</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleOverwrite(tpl); }}
              className="text-text-muted hover:text-primary p-0.5"
              title={t("master.label.overwrite")}
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(tpl); }}
              className="text-text-muted hover:text-red-500 p-0.5"
              title={t("master.label.delete")}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
    <ConfirmModal
      isOpen={!!deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onConfirm={handleDelete}
      title={t("common.deleteConfirm", "삭제 확인")}
      message={`${deleteTarget?.templateName ?? ""} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
      variant="danger"
    />
    <ConfirmModal
      isOpen={!!pendingLoad}
      onClose={() => setPendingLoad(null)}
      onConfirm={() => { if (pendingLoad) doLoad(pendingLoad); setPendingLoad(null); }}
      title={t("master.label.unsavedTitle", "저장하지 않은 변경사항")}
      message={t("master.label.unsavedMessage", "현재 작업 중인 라벨이 저장되지 않았습니다. 다른 템플릿을 불러오면 변경사항이 사라집니다. 계속할까요?")}
      confirmText={t("master.label.discardAndLoad", "변경 무시하고 불러오기")}
      variant="danger"
    />
    </>
  );
}
