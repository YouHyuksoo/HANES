/**
 * @file src/lib/jisungUiAdapters.ts
 * @description 공용 UI 패키지(@jisung/ui)에 넘기는 HANES 전용 기능.
 * - HelpTarget: 투어/도움말 대상 표시
 * - fetchTableColumns: DataGrid SQL 보기의 테이블 명세 조회
 * - getActualSql: 최근 API 응답에서 수집한 실제 실행 SQL
 */
import type { TableSchema, UIAdapters } from "@jisung/ui";
import HelpTarget from "@/components/tour/HelpTarget";
import { api, getLatestActualSqlForPreview } from "@/services/api";
// 앱 시작 시 패키지 탭·테마 스토어에 HANES 설정(대시보드 고정 탭, 최대 탭 수, 테마 저장 키)을 넘긴다.
import "@/stores/tabStore";
import "@/stores/themeStore";

export const jisungUiAdapters: UIAdapters = {
  HelpTarget,
  fetchTableColumns: (tableName) =>
    api
      .get<{ data: TableSchema }>(`/system/table-schema?table=${tableName}`)
      .then((res) => res.data.data),
  getActualSql: getLatestActualSqlForPreview,
};
