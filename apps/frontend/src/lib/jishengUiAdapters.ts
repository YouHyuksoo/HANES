/**
 * @file src/lib/jishengUiAdapters.ts
 * @description 공용 UI 패키지(@jisheng/ui)에 넘기는 HANES 전용 기능.
 * - HelpTarget: 투어/도움말 대상 표시
 * - fetchTableColumns: DataGrid SQL 보기의 테이블 명세 조회
 */
import type { TableSchema, UIAdapters } from "@jisheng/ui";
import HelpTarget from "@/components/tour/HelpTarget";
import { api } from "@/services/api";

export const jishengUiAdapters: UIAdapters = {
  HelpTarget,
  fetchTableColumns: (tableName) =>
    api
      .get<{ data: TableSchema }>(`/system/table-schema?table=${tableName}`)
      .then((res) => res.data.data),
};
