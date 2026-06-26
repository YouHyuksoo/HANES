/**
 * @file src/app/(authenticated)/master/label/hooks/useLabelTemplates.ts
 * @description 라벨 템플릿 CRUD 커스텀 훅 - API 연동으로 저장/불러오기/삭제
 *
 * 초보자 가이드:
 * 1. **fetchList**: 카테고리별 템플릿 목록 조회
 * 2. **save**: 현재 디자인을 DB에 저장
 * 3. **load**: 선택한 템플릿의 디자인 불러오기
 * 4. **remove**: 템플릿 삭제
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import { LabelDesign, LabelCategory } from "../types";

export interface LabelTemplateItem {
  /** DB 복합키: "templateName::category" */
  templateKey: string;
  templateName: string;
  category: string;
  designData: LabelDesign;
  isDefault: boolean;
  remark?: string;
  updatedAt: string;
  zplCode?: string;
  printMode?: string;
  printerId?: string;
}

const BASE = "/master/label-templates";

export function useLabelTemplates() {
  const [templates, setTemplates] = useState<LabelTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  // 마지막으로 목록 조회를 완료한 카테고리(자동 로드 타이밍 가드용)
  const [fetchedCategory, setFetchedCategory] = useState<LabelCategory | undefined>(undefined);

  /** 카테고리별 목록 조회 */
  const fetchList = useCallback(async (category?: LabelCategory) => {
    setLoading(true);
    try {
      const params = category ? { category } : {};
      const res = await api.get(BASE, { params });
      const raw = res.data?.data ?? [];
      // DB 복합키를 화면/API 호출용 key로 생성
      setTemplates(raw.map((tpl: any) => ({
        ...tpl,
        templateKey: `${tpl.templateName}::${tpl.category}`,
        designData: typeof tpl.designData === 'string' ? JSON.parse(tpl.designData) : tpl.designData,
      })));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
      setFetchedCategory(category);
    }
  }, []);

  /** 새 템플릿 저장 */
  const save = useCallback(
    async (name: string, category: LabelCategory, design: LabelDesign, isDefault = false, extras?: { zplCode?: string; printMode?: string }) => {
      const res = await api.post(BASE, {
        templateName: name,
        category,
        designData: design,
        isDefault,
        ...extras,
      });
      return res.data?.data as LabelTemplateItem;
    },
    [],
  );

  /** 기존 템플릿 덮어쓰기 */
  const update = useCallback(
    async (templateKey: string, design: LabelDesign, extras?: { templateName?: string; isDefault?: boolean; zplCode?: string; printMode?: string }) => {
      const res = await api.put(`${BASE}/${templateKey}`, {
        designData: design,
        ...extras,
      });
      return res.data?.data as LabelTemplateItem;
    },
    [],
  );

  /** 삭제 */
  const remove = useCallback(async (templateKey: string) => {
    await api.delete(`${BASE}/${templateKey}`);
  }, []);

  return { templates, loading, fetchedCategory, fetchList, save, update, remove };
}
