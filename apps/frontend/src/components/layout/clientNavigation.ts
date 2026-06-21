"use client";

export function navigateClientOnly(path: string) {
  if (typeof window === "undefined") return;

  const url = new URL(path, window.location.origin);
  const target = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target === current) return;

  window.history.pushState(null, "", target);
}
