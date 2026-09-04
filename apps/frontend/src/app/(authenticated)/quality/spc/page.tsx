"use client";

/**
 * @file src/app/(authenticated)/quality/spc/page.tsx
 * @description 고전압 하네스 SPC 관리도 페이지 — 관리대상 목록 + X̄-R 관리도·공정능력·규칙 위반 (읽기 전용).
 *
 * 초보자 가이드:
 * 1. **HvSpcBoard**: 툴바(기간·서브그룹 k·공정·검색) + 좌측 관리대상 목록 + 우측 관리도 상세
 * 2. API: GET /quality/spc/hv/targets, GET /quality/spc/hv/targets/:targetId (계산은 전부 백엔드)
 * 3. 데이터 소스가 목업이면 툴바에 배너가 뜬다 (sourceKind='MOCK')
 * 4. 디자인 규칙: docs/design/hv-spc.md — 상태는 값에만 색, 파스텔 배경·카드 격자 금지
 * 5. 원본: WebDisplay /hanes/spc (HvSpcBoard) 이식. 기존 관리도 CRUD 화면은 폐기됨.
 */
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
import HvSpcBoard from "./components/HvSpcBoard";

export default function SpcPage() {
  const { t } = useTranslation();
  usePageAiTools("quality.spc");

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />{t("quality.spc.hv.title", "고전압 하네스 SPC 관리도")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.spc.hv.subtitle", "공정별 관리 특성의 X̄-R 관리도와 공정능력(Cpk)을 조회하고 관리한계 이탈·패턴 규칙 위반을 감시합니다.")}</p>
        </div>
      </div>

      {/* 보드 */}
      <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
        <HvSpcBoard />
      </div>
    </div>
  );
}
