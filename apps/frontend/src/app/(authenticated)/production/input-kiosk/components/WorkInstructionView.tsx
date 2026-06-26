"use client";

/**
 * @file components/WorkInstructionView.tsx
 * @description 중앙 패널 — 작업지도서 이미지/문서 뷰어
 *
 * 초보자 가이드:
 * - API: GET /master/work-instructions?itemCode=&processCode=
 * - 품목코드는 선택된 작업지시, 공정코드는 선택된 설비 기준으로 조회한다
 *   → 같은 작업지시라도 설비(공정)가 다르면 다른 작업지도서가 표시된다
 * - imageUrl이 있으면 이미지 표시, 없으면 플레이스홀더
 * - 복수 페이지 지원: 목록 상단 탭으로 전환
 *
 * 재사용 모드:
 * - props(itemCode/processCode)를 전달하면 그 값으로 조회한다(예: 서브공정 키팅 화면).
 * - props 미전달 시 kioskStore(selectedJobOrder/selectedEquip)에서 읽는다(키오스크 기본 동작).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import { resolveBackendFileUrl } from '@/utils/file-url';

interface WorkInstruction {
  id: string;
  title: string;
  imageUrl?: string;
  content?: string;
  revision?: string;
}

/** 파일 확장자(쿼리/해시 제거) 판별 유틸 */
const filePath = (url: string) => url.split(/[?#]/)[0] ?? url;
const isImageUrl = (url?: string | null) => !!url && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(filePath(url));
const isPdfUrl = (url?: string | null) => !!url && /\.pdf$/i.test(filePath(url));
/** PowerPoint(ppt/pptx/pps/ppsx)·Word(doc/docx) — Office Online 임베드 대상 */
const isOfficeUrl = (url?: string | null) => !!url && /\.(pptx?|ppsx?|docx?)$/i.test(filePath(url));

/** Microsoft Office Online 뷰어 임베드 URL (변환 없이 PPTX/PPSX 슬라이드쇼 재생).
 *  src는 인터넷에서 접근 가능한 절대 공개 URL이어야 한다(resolveBackendFileUrl 변환값 전달, 사내망 전용이면 동작 불가). */
const officeEmbedUrl = (absUrl: string) =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absUrl)}`;

interface WorkInstructionViewProps {
  /** 주입 모드 — 작업지도서를 조회할 품목코드. 미전달 시 kioskStore의 선택 작업지시 품목을 사용. */
  itemCode?: string;
  /** 주입 모드 — 조회 공정코드. 미전달 시 kioskStore의 선택 설비/작업지시 공정을 사용. */
  processCode?: string;
}

export default function WorkInstructionView({
  itemCode: itemCodeProp,
  processCode: processCodeProp,
}: WorkInstructionViewProps = {}) {
  const { t } = useTranslation();
  const { selectedJobOrder, selectedEquip } = useKioskStore();
  const [instructions, setInstructions] = useState<WorkInstruction[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);

  // 페이지 전환 시 이미지 로드 에러 상태 리셋
  useEffect(() => { setImgError(false); }, [activeIdx]);

  // 조회 기준: props 우선, 없으면 kioskStore(작업지시 품목 / 설비·작업지시 공정)로 폴백
  const itemCode = itemCodeProp ?? selectedJobOrder?.itemCode;
  const processCode = processCodeProp ?? selectedEquip?.processCode ?? selectedJobOrder?.processCode;

  useEffect(() => {
    if (!itemCode) { setInstructions([]); return; }
    const params: Record<string, string> = {
      itemCode,
      useYn: 'Y',
      limit: '20',
    };
    if (processCode) params.processCode = processCode;
    api.get('/master/work-instructions', { params })
      .then(res => {
        setInstructions(res.data?.data ?? []);
        setActiveIdx(0);
      })
      .catch(() => setInstructions([]));
  }, [itemCode, processCode]);

  const current = instructions[activeIdx];
  const fileUrl = current?.imageUrl ? resolveBackendFileUrl(current.imageUrl) : null;
  const canGoPrev = activeIdx > 0;
  const canGoNext = activeIdx < instructions.length - 1;
  const prevDisabledReason = canGoPrev
    ? ""
    : t("kiosk.instruction.noPrevPage", "이전 페이지가 없습니다");
  const nextDisabledReason = canGoNext
    ? ""
    : t("kiosk.instruction.noNextPage", "다음 페이지가 없습니다");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 shrink-0 bg-card">
        <BookOpen className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-text">{t('kiosk.instruction.title')}</span>
        {instructions.length > 1 && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
              title={prevDisabledReason || t('kiosk.instruction.prevPage', '이전')}
              className="p-0.5 text-text-muted hover:text-text disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-text-muted tabular-nums">
              {activeIdx + 1} / {instructions.length}
            </span>
            <button onClick={() => setActiveIdx(i => Math.min(instructions.length - 1, i + 1))}
              disabled={activeIdx === instructions.length - 1}
              title={nextDisabledReason || t('kiosk.instruction.nextPage', '다음')}
              className="p-0.5 text-text-muted hover:text-text disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {isImageUrl(current?.imageUrl) && (
          <button onClick={() => setZoomed(true)}
            className="p-1 text-text-muted hover:text-primary transition-colors ml-1">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 제목 */}
      {current?.title && (
        <div className="px-3 py-1.5 bg-surface/50 border-b border-border/30 shrink-0">
          <p className="text-xs text-text font-medium truncate">{current.title}</p>
          {current.revision && (
            <span className="text-xs text-text-muted">Rev. {current.revision}</span>
          )}
        </div>
      )}

      {/* 이미지 영역 */}
      <div className="flex-1 overflow-auto bg-surface/20 min-h-0">
        {!itemCode ? (
          <div className="flex flex-col items-center justify-center gap-2 text-text-muted h-full">
            <BookOpen className="w-12 h-12 opacity-20" />
            <span className="text-sm">{t('kiosk.instruction.selectJobOrder')}</span>
          </div>
        ) : instructions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-text-muted h-full">
            <BookOpen className="w-12 h-12 opacity-20" />
            <span className="text-sm">{t('kiosk.instruction.noInstruction')}</span>
            <span className="text-xs opacity-60">{t('kiosk.instruction.noInstructionHint')}</span>
          </div>
        ) : fileUrl && isImageUrl(current?.imageUrl) && !imgError ? (
          <img
            src={fileUrl}
            alt={current.title}
            className="w-full h-auto object-contain cursor-zoom-in"
            onClick={() => setZoomed(true)}
            onError={() => setImgError(true)}
          />
        ) : fileUrl && isPdfUrl(current?.imageUrl) ? (
          <iframe
            src={fileUrl}
            className="w-full h-full min-h-[60vh]"
            title={current?.title}
          />
        ) : fileUrl && isOfficeUrl(current?.imageUrl) ? (
          <div className="flex h-full min-h-[60vh] flex-col">
            <iframe
              src={officeEmbedUrl(fileUrl)}
              className="w-full flex-1"
              title={current?.title}
              allowFullScreen
            />
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 border-t border-border bg-card px-3 py-2 text-xs text-primary hover:underline"
            >
              {t('kiosk.instruction.openExternal', '재생이 안 되면 새 탭에서 열기')}
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-text-muted p-4 text-center h-full">
            <BookOpen className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium text-text">{current?.title}</p>
            {current?.content && (
              <p className="text-xs text-text-muted max-w-sm whitespace-pre-line">{current.content}</p>
            )}
          </div>
        )}
      </div>

      {/* 줌 오버레이 */}
      {zoomed && fileUrl && isImageUrl(current?.imageUrl) && !imgError && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img
            src={fileUrl}
            alt={current.title}
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}
