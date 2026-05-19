"use client";

/**
 * @file components/ResultView.tsx
 * @description 요구사항 수집 결과 — 이미지 오버레이 + 섹션 카드 + JSON/AI 내보내기
 */
import { useState, useRef, useCallback } from 'react';
import { Upload, Download, Copy, Check, ImageOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { KIOSK_SECTIONS, type Answers, type Section } from '../config/kioskSections';

interface Props {
  answers: Answers;
}

const OVERLAY_STYLES: Record<string, { box: string; badge: string }> = {
  blue:   { box: 'bg-blue-400/25 border-blue-500 hover:bg-blue-400/45',   badge: 'bg-blue-600' },
  green:  { box: 'bg-green-400/25 border-green-500 hover:bg-green-400/45', badge: 'bg-green-600' },
  orange: { box: 'bg-orange-400/25 border-orange-500 hover:bg-orange-400/45', badge: 'bg-orange-600' },
  purple: { box: 'bg-purple-400/25 border-purple-500 hover:bg-purple-400/45', badge: 'bg-purple-600' },
};

function getDisplayValue(section: Section, qid: string, raw: string | string[]): string {
  const q = section.questions.find(q => q.id === qid);
  if (!q) return String(raw);
  if (q.type === 'boolean') return raw === 'yes' ? '예' : '아니오';
  if (Array.isArray(raw)) {
    return raw.map(v => q.options?.find(o => o.value === v)?.label ?? v).join(', ') || '-';
  }
  return q.options?.find(o => o.value === raw)?.label ?? raw;
}

function buildAiPrompt(answers: Answers): string {
  const lines = [
    '# 생산실적 입력 키오스크 — 화면 요구사항 명세',
    '',
    `생성일시: ${new Date().toLocaleString('ko-KR')}`,
    `대상 URL: /production/input-kiosk`,
    '',
    '---',
    '',
  ];
  for (const section of KIOSK_SECTIONS) {
    lines.push(`## ${section.title}`);
    lines.push(`> ${section.description}`);
    lines.push('');
    for (const q of section.questions) {
      const val = answers[q.id];
      if (!val || (Array.isArray(val) && val.length === 0)) continue;
      lines.push(`**${q.label}**`);
      lines.push(`→ ${getDisplayValue(section, q.id, val)}`);
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('위 요구사항을 기반으로 `/production/input-kiosk` 페이지의 각 컴포넌트를 완전히 구현해 주세요.');
  lines.push('현재 컴포넌트 골격(껍데기)은 있으나 실제 동작 로직이 미완성입니다.');
  return lines.join('\n');
}

export default function ResultView({ answers }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImageUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDownload = useCallback(() => {
    const payload = {
      screen: 'input-kiosk',
      generatedAt: new Date().toISOString(),
      sections: Object.fromEntries(
        KIOSK_SECTIONS.map(s => [
          s.id,
          {
            title: s.title,
            answers: Object.fromEntries(
              s.questions
                .filter(q => {
                  const v = answers[q.id];
                  return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
                })
                .map(q => [
                  q.id,
                  { label: q.label, value: answers[q.id], display: getDisplayValue(s, q.id, answers[q.id] as string | string[]) },
                ])
            ),
          },
        ])
      ),
      aiPrompt: buildAiPrompt(answers),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiosk-requirements-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('요구사항 파일을 다운로드했습니다');
  }, [answers]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(buildAiPrompt(answers));
    setCopied(true);
    toast.success('AI 프롬프트가 클립보드에 복사되었습니다');
    setTimeout(() => setCopied(false), 2000);
  }, [answers]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
        <p className="text-sm font-semibold text-green-700 dark:text-green-300">✓ 모든 섹션 입력 완료</p>
        <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
          화면 이미지를 업로드하면 섹션별 오버레이로 요구사항을 시각화할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* 왼쪽: 이미지 + 오버레이 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">레이아웃 오버레이</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs font-medium text-text hover:bg-surface transition-colors"
            >
              <Upload className="w-3 h-3" />
              {imageUrl ? '이미지 교체' : '이미지 업로드'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          <div
            className="relative w-full overflow-hidden rounded-lg border-2 border-dashed border-border bg-surface"
            style={{ aspectRatio: '16/10' }}
          >
            {imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="kiosk layout" className="h-full w-full object-contain" />
                {KIOSK_SECTIONS.map(section => {
                  const { x, y, w, h } = section.overlayArea;
                  const styles = OVERLAY_STYLES[section.color];
                  const isHov = hovered === section.id;
                  return (
                    <div
                      key={section.id}
                      className={`absolute border-2 cursor-pointer transition-all ${styles.box} ${isHov ? 'z-10' : 'z-0'}`}
                      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
                      onMouseEnter={() => setHovered(section.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className={`absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-bold text-white ${styles.badge}`}>
                        {section.title}
                      </span>
                      {isHov && (
                        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card p-2.5 shadow-xl text-xs">
                          {section.questions.slice(0, 3).map(q => {
                            const val = answers[q.id];
                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                            return (
                              <div key={q.id} className="mb-1.5 last:mb-0">
                                <p className="text-text-muted leading-tight">{q.label.slice(0, 22)}…</p>
                                <p className="font-semibold text-text leading-tight">{getDisplayValue(section, q.id, val as string | string[])}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <button
                type="button"
                className="flex h-full w-full flex-col items-center justify-center gap-2 hover:bg-surface/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <ImageOff className="w-10 h-10 text-text-muted opacity-30" />
                <span className="text-xs text-text-muted">클릭하여 키오스크 화면 스크린샷 업로드</span>
              </button>
            )}
          </div>

          {/* 범례 */}
          <div className="flex flex-wrap gap-2">
            {KIOSK_SECTIONS.map(s => (
              <div key={s.id} className="flex items-center gap-1">
                <div className={`h-2.5 w-2.5 rounded-sm ${OVERLAY_STYLES[s.color].badge}`} />
                <span className="text-[10px] text-text-muted">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 섹션별 요약 카드 */}
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '420px' }}>
          {KIOSK_SECTIONS.map(section => (
            <div
              key={section.id}
              className={`rounded-lg border p-3 transition-all ${
                hovered === section.id ? 'border-primary shadow-md' : 'border-border'
              } bg-card`}
              onMouseEnter={() => setHovered(section.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <h4 className="mb-2 text-sm font-bold text-text">{section.title}</h4>
              <div className="space-y-1">
                {section.questions.map(q => {
                  const val = answers[q.id];
                  if (!val || (Array.isArray(val) && val.length === 0)) return null;
                  return (
                    <div key={q.id} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <p className="text-xs text-text-muted leading-snug">
                        <span className="font-medium text-text">{getDisplayValue(section, q.id, val as string | string[])}</span>
                        {' '}
                        <span className="text-text-muted">({q.label.slice(0, 16)}…)</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 내보내기 버튼 */}
      <div className="flex gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          JSON 다운로드
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text hover:bg-surface transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          {copied ? '복사 완료!' : 'AI 프롬프트 복사'}
        </button>
      </div>
    </div>
  );
}
