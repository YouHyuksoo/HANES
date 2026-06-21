"use client";

import { useEffect, useState } from "react";
import { helpDocPath, parseHelpDoc, type HelpMeta, type HelpTab } from "@/lib/help";

/** 도움말 .md를 fetch + frontmatter 분리. menuCode 없거나 404면 notFound=true */
export function useHelpDoc(menuCode: string | undefined, tab: HelpTab) {
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
    fetch(helpDocPath(tab, menuCode))
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        // public 404가 HTML로 200 반환될 수 있어 방어
        if (text.trimStart().startsWith("<")) throw new Error("not found");
        const { meta: m, body } = parseHelpDoc(text);
        setMeta(m);
        setContent(body);
      })
      .catch(() => {
        if (cancelled) return;
        setContent(null);
        setMeta(null);
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [menuCode, tab]);

  return { meta, content, loading, notFound };
}
