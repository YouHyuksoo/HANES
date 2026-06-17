"use client";

export function resolveBackendFileUrl(url?: string | null): string {
  if (!url) return "";
  if (/^(?:https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  if (!url.startsWith("/uploads")) {
    return url;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const backendBase = apiBase.replace(/\/api(?:\/v1)?\/?$/, "");
  return `${backendBase}${url}`;
}
