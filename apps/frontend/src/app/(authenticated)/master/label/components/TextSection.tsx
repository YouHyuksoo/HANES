"use client";

/**
 * @file src/app/(authenticated)/master/label/components/TextSection.tsx
 * @description 라벨 텍스트 요소 설정 섹션 - 활성화, 위치, 폰트, 정렬 설정
 *
 * 초보자 가이드:
 * 1. **활성화 토글**: 텍스트 표시 여부 on/off
 * 2. **위치**: X, Y 좌표 (mm 단위)
 * 3. **폰트**: 글꼴, 크기, 굵기, 정렬 설정
 */
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";
import { TextConfig, FONT_OPTIONS } from "../types";

interface TextSectionProps {
  title: string;
  config: TextConfig;
  onChange: (c: TextConfig) => void;
}

/** 숫자 입력 헬퍼 */
export function NumInput({ label, value, onChange, min = 0, max = 200, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1 text-sm rounded border border-border bg-surface text-text focus:border-primary focus:outline-none"
      />
    </label>
  );
}

export default function TextSection({ title, config, onChange }: TextSectionProps) {
  const { t } = useTranslation();
  const fontOpts = FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }));
  const aligns: { value: TextConfig["align"]; label: string }[] = [
    { value: "left", label: t("master.label.alignLeft") },
    { value: "center", label: t("master.label.alignCenter") },
    { value: "right", label: t("master.label.alignRight") },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text">{title}</span>
        <label className="flex items-center gap-1 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox" checked={config.enabled} className="accent-primary"
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          />
          {t("master.label.enabled")}
        </label>
      </div>
      {config.enabled && (
        <div className="grid grid-cols-4 gap-2">
          <NumInput label={t("master.label.posX")} value={config.x} onChange={(v) => onChange({ ...config, x: v })} />
          <NumInput label={t("master.label.posY")} value={config.y} onChange={(v) => onChange({ ...config, y: v })} />
          <NumInput label={t("master.label.fontSizePt")} value={config.fontSize} onChange={(v) => onChange({ ...config, fontSize: v })} min={5} max={30} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">&nbsp;</span>
            <div className="flex gap-0.5">
              {aligns.map((a) => (
                <button
                  key={a.value}
                  onClick={() => onChange({ ...config, align: a.value })}
                  className={`flex-1 text-xs py-1 rounded border transition-colors ${
                    config.align === a.value
                      ? "bg-primary text-white border-primary"
                      : "bg-surface text-text-muted border-border hover:border-primary"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </label>
          <div className="col-span-2">
            <Select
              label={t("master.label.font")}
              options={fontOpts} value={config.fontFamily}
              onChange={(v) => onChange({ ...config, fontFamily: v as TextConfig["fontFamily"] })}
              fullWidth
            />
          </div>
          <label className="flex items-end gap-1.5 pb-0.5 col-span-2">
            <input
              type="checkbox" checked={config.bold} className="accent-primary"
              onChange={(e) => onChange({ ...config, bold: e.target.checked })}
            />
            <span className="text-xs font-bold text-text">{t("master.label.bold")}</span>
          </label>
        </div>
      )}
    </div>
  );
}
