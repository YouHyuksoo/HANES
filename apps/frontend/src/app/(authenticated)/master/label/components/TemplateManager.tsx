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
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Save, FolderOpen, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui";
import { LabelDesign, LabelCategory } from "../types";
import { useLabelTemplates, LabelTemplateItem } from "../hooks/useLabelTemplates";

interface TemplateManagerProps {
  category: LabelCategory;
  design: LabelDesign;
  onLoad: (design: LabelDesign) => void;
}

export default function TemplateManager({ category, design, onLoad }: TemplateManagerProps) {
  const { t } = useTranslation();
  const { templates, loading, fetchList, save, update, remove } = useLabelTemplates();
  const [saveName, setSaveName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchList(category);
  }, [category, fetchList]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    try {
      await save(saveName.trim(), category, design);
      setSaveName("");
      setShowSave(false);
      fetchList(category);
    } catch {
      // 중복명 등 에러 시 무시 (toast 추가 가능)
    }
  };

  const handleOverwrite = async (tpl: LabelTemplateItem) => {
    await update(tpl.id, design);
    fetchList(category);
  };

  const handleLoad = (tpl: LabelTemplateItem) => {
    setSelectedId(tpl.id);
    onLoad(tpl.designData);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    if (selectedId === id) setSelectedId(null);
    fetchList(category);
  };

  return (
    <div className="space-y-3">
      {/* 헤더 + 새 저장 토글 */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-primary" />
          {t("master.label.templateList")}
        </h4>
        <Button
          size="sm"
          variant={showSave ? "secondary" : "primary"}
          onClick={() => { setShowSave(!showSave); setTimeout(() => inputRef.current?.focus(), 50); }}
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          {t("master.label.saveNew")}
        </Button>
      </div>

      {/* 새 저장 입력 */}
      {showSave && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={t("master.label.templateNamePlaceholder")}
            className="flex-1 px-2 py-1.5 text-sm rounded border border-border bg-surface text-text focus:border-primary focus:outline-none"
          />
          <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>
            {t("master.label.save")}
          </Button>
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
            key={tpl.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
              selectedId === tpl.id
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
              onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }}
              className="text-text-muted hover:text-red-500 p-0.5"
              title={t("master.label.delete")}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
