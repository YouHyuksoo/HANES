"use client";

/**
 * @file components/QuestionSection.tsx
 * @description 요구사항 수집 위저드 — 섹션별 질문 렌더러
 */
import { type Section, type Answers } from '../config/kioskSections';

interface Props {
  section: Section;
  answers: Answers;
  onChange: (qid: string, value: string | string[]) => void;
}

const SECTION_COLORS: Record<string, string> = {
  blue: 'border-l-blue-400 bg-blue-50 dark:bg-blue-900/20',
  green: 'border-l-green-400 bg-green-50 dark:bg-green-900/20',
  orange: 'border-l-orange-400 bg-orange-50 dark:bg-orange-900/20',
  purple: 'border-l-purple-400 bg-purple-50 dark:bg-purple-900/20',
};

export default function QuestionSection({ section, answers, onChange }: Props) {
  const toggleMulti = (qid: string, value: string) => {
    const current = (answers[qid] as string[] | undefined) ?? [];
    onChange(qid, current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]);
  };

  return (
    <div className="space-y-5">
      {/* 섹션 설명 */}
      <div className={`rounded-lg border-l-4 p-4 ${SECTION_COLORS[section.color]}`}>
        <h2 className="text-lg font-bold text-text">{section.title}</h2>
        <p className="mt-1 text-sm text-text-muted">{section.description}</p>
      </div>

      {/* 질문 목록 */}
      {section.questions.map(q => (
        <div key={q.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <label className="mb-3 block text-sm font-semibold text-text">
            {q.label}
            {q.required && <span className="ml-1 text-red-500">*</span>}
          </label>

          {q.hint && (
            <p className="mb-2 rounded bg-surface px-2 py-1 text-xs text-text-muted">{q.hint}</p>
          )}

          {/* 라디오 */}
          {q.type === 'radio' && q.options && (
            <div className="space-y-1.5">
              {q.options.map(opt => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                    answers[q.id] === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt.value}
                    checked={answers[q.id] === opt.value}
                    onChange={() => onChange(q.id, opt.value)}
                    className="accent-primary shrink-0"
                  />
                  <span className="text-sm text-text">{opt.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* 멀티셀렉트 */}
          {q.type === 'multiselect' && q.options && (
            <div className="space-y-1.5">
              {q.options.map(opt => {
                const selected = ((answers[q.id] as string[] | undefined) ?? []).includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleMulti(q.id, opt.value)}
                      className="accent-primary shrink-0"
                    />
                    <span className="text-sm text-text">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* 불리언 (예/아니오) */}
          {q.type === 'boolean' && (
            <div className="flex gap-3">
              {(['yes', 'no'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(q.id, v)}
                  className={`flex-1 rounded-md border py-2.5 text-sm font-semibold transition-colors ${
                    answers[q.id] === v
                      ? v === 'yes'
                        ? 'border-green-500 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'border-border bg-surface text-text hover:bg-surface/80'
                  }`}
                >
                  {v === 'yes' ? '✓  예 (Yes)' : '✗  아니오 (No)'}
                </button>
              ))}
            </div>
          )}

          {/* 텍스트 */}
          {q.type === 'text' && (
            <input
              type="text"
              value={(answers[q.id] as string) ?? ''}
              onChange={e => onChange(q.id, e.target.value)}
              placeholder={q.placeholder}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}

          {/* 텍스트에어리어 */}
          {q.type === 'textarea' && (
            <textarea
              value={(answers[q.id] as string) ?? ''}
              onChange={e => onChange(q.id, e.target.value)}
              placeholder={q.placeholder}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      ))}
    </div>
  );
}
