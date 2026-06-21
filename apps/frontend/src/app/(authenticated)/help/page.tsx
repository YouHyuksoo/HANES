"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Search } from "lucide-react";
import { Card, CardContent, Input } from "@/components/ui";
import { useHelpManifest } from "@/hooks/useHelpManifest";
import { useHelpDoc } from "@/hooks/useHelpDoc";
import { filterManifest, type HelpTab } from "@/lib/help";
import MarkdownRenderer from "@/components/help/MarkdownRenderer";

export default function HelpIndexPage() {
  const { t } = useTranslation();
  const { manifest, loading } = useHelpManifest();
  const [tab, setTab] = useState<HelpTab>("user");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const categories = useMemo(
    () => (manifest ? filterManifest(manifest, query) : []),
    [manifest, query],
  );

  const { content, loading: docLoading, notFound } = useHelpDoc(selected, tab);

  const tabs: { key: HelpTab; label: string }[] = [
    { key: "user", label: t("help.tabUser", "사용자") },
    { key: "operator", label: t("help.tabOperator", "운영자") },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex items-center gap-2 flex-shrink-0">
        <BookOpen className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-text">{t("help.title", "도움말")}</h1>
          <p className="text-text-muted mt-0.5 text-sm">{t("help.indexSubtitle", "전체 화면 사용법과 운영 가이드")}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 좌측 목차 */}
        <Card className="col-span-4 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-3 overflow-hidden flex flex-col">
            <div className="flex border-b border-border mb-2">
              {tabs.map((tb) => (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    tab === tb.key ? "border-b-2 border-primary text-primary" : "text-text-muted hover:text-text"
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("help.searchPlaceholder", "도움말 검색")}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
              className="mb-2"
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-sm text-text-muted">{t("common.loading", "로딩 중...")}</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.key} className="mb-3">
                    <p className="px-2 py-1 text-xs font-semibold text-text-muted">{cat.title}</p>
                    {cat.items.map((it) => (
                      <button
                        key={it.menuCode}
                        onClick={() => setSelected(it.menuCode)}
                        className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${
                          selected === it.menuCode ? "bg-primary/10 text-primary font-medium" : "text-text hover:bg-surface"
                        }`}
                      >
                        {it.title}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 우측 본문 */}
        <Card className="col-span-8 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-5 overflow-y-auto">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
                <BookOpen className="h-12 w-12 opacity-20" />
                <p className="text-sm">{t("help.selectItem", "좌측에서 도움말 항목을 선택하세요.")}</p>
              </div>
            ) : docLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notFound || !content ? (
              <p className="text-sm text-text-muted">{t("help.notReady", "이 화면의 도움말은 준비 중입니다.")}</p>
            ) : (
              <MarkdownRenderer content={content} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
