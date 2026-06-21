"use client";

import { useEffect, useState } from "react";
import type { HelpManifest } from "@/lib/help";

/** 도움말 목차(manifest.json) fetch */
export function useHelpManifest() {
  const [manifest, setManifest] = useState<HelpManifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/help/manifest.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HelpManifest | null) => {
        if (!cancelled) setManifest(data);
      })
      .catch(() => {
        if (!cancelled) setManifest(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { manifest, loading };
}
