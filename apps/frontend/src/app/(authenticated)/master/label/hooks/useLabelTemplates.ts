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
  id: string;
  templateName: string;
  category: string;
  designData: LabelDesign;
  isDefault: boolean;
  remark?: string;
  updatedAt: string;
}

const BASE = "/master/label-templates";

export function useLabelTemplates() {
  const [templates, setTemplates] = useState<LabelTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);

  /** 카테고리별 목록 조회 */
  const fetchList = useCallback(async (category?: LabelCategory) => {
    setLoading(true);
    try {
      const params = category ? { category } : {};
      const res = await api.get(BASE, { params });
      setTemplates(res.data?.data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 새 템플릿 저장 */
  const save = useCallback(
    async (name: string, category: LabelCategory, design: LabelDesign, isDefault = false) => {
      const res = await api.post(BASE, {
        templateName: name,
        category,
        designData: design,
        isDefault,
      });
      return res.data?.data as LabelTemplateItem;
    },
    [],
  );

  /** 기존 템플릿 덮어쓰기 */
  const update = useCallback(
    async (id: string, design: LabelDesign, extras?: { templateName?: string; isDefault?: boolean }) => {
      const res = await api.put(`${BASE}/${id}`, {
        designData: design,
        ...extras,
      });
      return res.data?.data as LabelTemplateItem;
    },
    [],
  );

  /** 삭제 */
  const remove = useCallback(async (id: string) => {
    await api.delete(`${BASE}/${id}`);
  }, []);

  return { templates, loading, fetchList, save, update, remove };
}
