"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { helpDocPath, parseHelpDoc, type HelpMeta, type HelpTab } from "@/lib/help";

function fetchDoc(path: string): Promise<string | null> {
  return fetch(path).then((res) => {
    if (!res.ok) return null;
    return res.text().then((text) => (text.trimStart().startsWith("<") ? null : text));
  });
}

/** 도움말 .md를 현재 언어로 fetch. 해당 언어 파일이 없으면 ko fallback */
export function useHelpDoc(menuCode: string | undefined, tab: HelpTab) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] ?? "ko";

  const [content, setContent] = useState<string | null>(null);
  const [meta, setMeta] = useState<HelpMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!menuCode) {
      setContent(null);
      setMeta(null);
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    void (async () => {
      try {
        const text = await fetchDoc(helpDocPath(tab, menuCode, lang));
        if (cancelled) return;
        if (text) {
          const { meta: m, body } = parseHelpDoc(text);
          setMeta(m);
          setContent(body);
          return;
        }
        if (lang !== "ko") {
          const fallbackText = await fetchDoc(helpDocPath(tab, menuCode, "ko"));
          if (cancelled) return;
          if (fallbackText) {
            const { meta: m, body } = parseHelpDoc(fallbackText);
            setMeta(m);
            setContent(body);
            return;
          }
        }
        setContent(null);
        setMeta(null);
        setNotFound(true);
      } catch {
        if (cancelled) return;
        setContent(null);
        setMeta(null);
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menuCode, tab, lang]);

  return { meta, content, loading, notFound };
}
