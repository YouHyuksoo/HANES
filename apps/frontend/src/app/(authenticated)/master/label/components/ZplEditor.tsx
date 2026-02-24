'use client';

/**
 * @file components/ZplEditor.tsx
 * @description ZPL 코드 에디터 - 외부 디자이너에서 만든 ZPL 코드 등록 및 미리보기
 *
 * 초보자 가이드:
 * 1. 인쇄 모드 선택 (브라우저/ZPL/둘 다)
 * 2. ZPL 코드 영역에 외부 디자이너 결과물 붙여넣기
 * 3. 변수 도우미로 플레이스홀더 삽입
 * 4. Labelary API로 ZPL 미리보기 확인
 */
import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Loader2 } from 'lucide-react';
import { Select, Button } from '@/components/ui';

interface ZplEditorProps {
  zplCode: string;
  onZplCodeChange: (code: string) => void;
  printMode: string;
  onPrintModeChange: (mode: string) => void;
}

/** 미리보기용 샘플 값 */
const SAMPLE_VALUES: Record<string, string> = {
  '{{lotNo}}': 'L20260222-1HMX',
  '{{partCode}}': '1020',
  '{{partName}}': 'SAMPLE PART',
  '{{qty}}': '300',
  '{{unit}}': 'EA',
  '{{vendor}}': 'ABC Corp',
  '{{recvDate}}': '2026-02-22',
  '{{barcode}}': 'L20260222-1HMX',
  '{{custom1}}': '', '{{custom2}}': '', '{{custom3}}': '',
  '{{custom4}}': '', '{{custom5}}': '',
};

/** 삽입 가능한 변수 목록 */
const VARIABLES = [
  '{{lotNo}}', '{{partCode}}', '{{partName}}', '{{qty}}',
  '{{unit}}', '{{vendor}}', '{{recvDate}}', '{{barcode}}',
  '{{custom1}}', '{{custom2}}', '{{custom3}}', '{{custom4}}', '{{custom5}}',
];

export default function ZplEditor({ zplCode, onZplCodeChange, printMode, onPrintModeChange }: ZplEditorProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  /** 인쇄 모드 옵션 */
  const printModeOptions = [
    { value: 'BROWSER', label: t('master.label.printModeBrowser', { defaultValue: '브라우저 인쇄' }) },
    { value: 'ZPL', label: t('master.label.printModeZpl', { defaultValue: 'ZPL 인쇄' }) },
    { value: 'BOTH', label: t('master.label.printModeBoth', { defaultValue: '병행(브라우저+ZPL)' }) },
  ];

  /** 커서 위치에 변수 삽입 */
  const insertVariable = useCallback((variable: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = zplCode.substring(0, start);
    const after = zplCode.substring(end);
    const next = before + variable + after;
    onZplCodeChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + variable.length;
      ta.setSelectionRange(pos, pos);
    });
  }, [zplCode, onZplCodeChange]);

  /** Labelary API 로 ZPL 미리보기 */
  const handlePreview = useCallback(async () => {
    if (!zplCode.trim()) return;
    setPreviewing(true);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    try {
      let resolved = zplCode;
      for (const [key, val] of Object.entries(SAMPLE_VALUES)) {
        resolved = resolved.replaceAll(key, val);
      }
      const res = await fetch(
        'http://api.labelary.com/v1/printers/8dpmm/labels/4x2/0/',
        { method: 'POST', headers: { Accept: 'image/png' }, body: resolved },
      );
      if (!res.ok) throw new Error('Labelary error');
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setPreviewUrl(null);
    } finally {
      setPreviewing(false);
    }
  }, [zplCode, previewUrl]);

  return (
    <div className="space-y-4">
      {/* 인쇄 모드 */}
      <Select
        label={t('master.label.printModeLabel', { defaultValue: '인쇄 모드' })}
        options={printModeOptions}
        value={printMode}
        onChange={onPrintModeChange}
        fullWidth
      />

      {/* ZPL 코드 입력 */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          {t('master.label.zplCode', { defaultValue: 'ZPL 코드' })}
        </label>
        <textarea
          ref={textareaRef}
          value={zplCode}
          onChange={(e) => onZplCodeChange(e.target.value)}
          placeholder={t('master.label.zplCodePlaceholder', { defaultValue: '^XA ... ^XZ 형태의 ZPL 코드를 붙여넣으세요' })}
          className="w-full min-h-[200px] px-3 py-2 font-mono text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
        />
      </div>

      {/* 변수 도우미 */}
      <div>
        <label className="block text-xs font-semibold text-text-muted mb-1.5">
          {t('master.label.variableHelper', { defaultValue: '변수 도우미 (클릭하여 삽입)' })}
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="px-2 py-1 text-xs font-mono rounded border border-border bg-surface text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors text-left truncate"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* 미리보기 */}
      <div className="space-y-2">
        <Button
          onClick={handlePreview}
          disabled={!zplCode.trim() || previewing}
          variant="secondary"
          className="w-full"
        >
          {previewing
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{t('common.loading')}</>
            : <><Eye className="w-4 h-4 mr-1.5" />{t('master.label.zplPreview', { defaultValue: 'ZPL 미리보기' })}</>
          }
        </Button>
        {previewUrl && (
          <div className="border border-border rounded-lg p-2 bg-white dark:bg-slate-900 flex justify-center">
            <img src={previewUrl} alt="ZPL Preview" className="max-w-full h-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
