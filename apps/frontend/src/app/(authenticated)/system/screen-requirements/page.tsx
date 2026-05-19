"use client";

/**
 * @file system/screen-requirements/page.tsx
 * @description MES 화면 요구사항 수집 도구 — 생산실적 키오스크 전용 스텝 위저드
 *
 * 초보자 가이드:
 * 1. 4개 섹션(헤더/자재/작업지도서/실적)을 순서대로 입력
 * 2. 입력 완료 후 시각화 페이지에서 레이아웃 이미지 오버레이 확인
 * 3. JSON 다운로드 또는 AI 프롬프트 복사로 개발자/AI에게 전달
 */
import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, ClipboardList } from 'lucide-react';
import { KIOSK_SECTIONS, type Answers } from './config/kioskSections';
import QuestionSection from './components/QuestionSection';
import ResultView from './components/ResultView';

const RESULT_LABEL = '결과 / 내보내기';
const ALL_STEPS = [...KIOSK_SECTIONS.map(s => s.title), RESULT_LABEL];

export default function ScreenRequirementsPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const handleChange = useCallback((qid: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  }, []);

  const currentSection = KIOSK_SECTIONS[step];
  const isResultStep = step === KIOSK_SECTIONS.length;
  const isLastContentStep = step === KIOSK_SECTIONS.length - 1;

  // 필수 항목 완료 여부 검사
  const isSectionComplete = currentSection
    ? currentSection.questions
        .filter(q => q.required)
        .every(q => {
          const v = answers[q.id];
          return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        })
    : true;

  // 전체 완료율 (선택형 항목 기준)
  const totalRequired = KIOSK_SECTIONS.flatMap(s => s.questions.filter(q => q.required)).length;
  const filledRequired = KIOSK_SECTIONS.flatMap(s =>
    s.questions.filter(q => q.required && answers[q.id] !== undefined && answers[q.id] !== '')
  ).length;
  const progressPct = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">

      {/* 상단 헤더 */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-base font-bold text-text">화면 요구사항 수집</h1>
            <p className="text-xs text-text-muted">생산실적 키오스크 · 각 섹션의 기능 방식을 선택하면 AI 구현 명세를 자동 생성합니다</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="h-1.5 w-32 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-text-muted">{progressPct}%</span>
          </div>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-3 overflow-x-auto">
        <div className="flex min-w-max items-center">
          {ALL_STEPS.map((label, idx) => {
            const isDone = idx < step;
            const isCurrent = idx === step;
            const isClickable = idx < step;
            return (
              <div key={idx} className="flex items-center">
                <button
                  type="button"
                  onClick={() => isClickable && setStep(idx)}
                  disabled={!isClickable}
                  className="flex flex-col items-center gap-1 disabled:cursor-default px-1"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isDone ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-primary text-white ring-2 ring-primary/30' :
                    'bg-border text-text-muted'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className={`max-w-[72px] text-center text-[10px] leading-tight ${
                    isCurrent ? 'font-bold text-primary' :
                    isDone ? 'text-green-600 dark:text-green-400' :
                    'text-text-muted'
                  }`}>{label}</span>
                </button>
                {idx < ALL_STEPS.length - 1 && (
                  <div className={`mx-2 h-px w-10 ${idx < step ? 'bg-green-500' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-2xl">
          {isResultStep ? (
            <ResultView answers={answers} />
          ) : (
            <QuestionSection
              section={currentSection}
              answers={answers}
              onChange={handleChange}
            />
          )}
        </div>
      </div>

      {/* 하단 네비게이션 바 */}
      <div className="shrink-0 border-t border-border bg-card px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          이전 섹션
        </button>

        <span className="text-xs text-text-muted">
          {isResultStep
            ? '모든 섹션 입력 완료 — JSON을 다운로드하거나 AI 프롬프트를 복사하세요'
            : `섹션 ${step + 1} / ${KIOSK_SECTIONS.length} · 필수 항목(*)을 모두 선택해야 다음으로 이동합니다`}
        </span>

        {isResultStep ? (
          <button
            type="button"
            onClick={() => setStep(0)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface transition-colors"
          >
            처음으로
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!isSectionComplete}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLastContentStep ? '결과 보기' : '다음 섹션'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
