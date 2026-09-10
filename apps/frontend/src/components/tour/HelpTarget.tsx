"use client";

export default function HelpTarget({ helpKey, label, fallbackDescription, children }: { helpKey: string; label: string; fallbackDescription?: string; children: React.ReactNode }) {
  void helpKey;
  void label;
  void fallbackDescription;
  return <>{children}</>;
}
