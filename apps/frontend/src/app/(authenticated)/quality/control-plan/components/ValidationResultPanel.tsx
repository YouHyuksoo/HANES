import { AlertTriangle, CircleCheck, CircleX } from 'lucide-react';
import type { ValidationResult } from '../controlPlanApi';

export default function ValidationResultPanel({ result, onSelect }: { result: ValidationResult | null; onSelect: (issue: ValidationResult['issues'][number]) => void }) {
  if (!result) return null;
  return <section className="shrink-0 border-t border-border bg-surface p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-text">{result.valid ? <CircleCheck className="h-4 w-4 text-emerald-500" /> : <CircleX className="h-4 w-4 text-red-500" />}검증결과 <span className="text-red-500">오류 {result.errorCount}</span><span className="text-amber-500">경고 {result.warningCount}</span></div><div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">{result.issues.map((issue, index) => <button key={`${issue.code}-${issue.rowId}-${index}`} onClick={() => onSelect(issue)} className={`flex items-center gap-1 rounded border px-2 py-1 text-left text-[11px] ${issue.severity === 'ERROR' ? 'border-red-400/40 bg-red-400/10 text-red-600' : 'border-amber-400/40 bg-amber-400/10 text-amber-700'}`}><AlertTriangle className="h-3 w-3" />{issue.documentType} · {issue.message}</button>)}</div></section>;
}
