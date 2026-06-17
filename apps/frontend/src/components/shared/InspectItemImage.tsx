"use client";

/**
 * @file src/components/shared/InspectItemImage.tsx
 * @description 점검항목 가이드 사진 썸네일 — 클릭 시 전체화면 확대(라이트박스)
 *
 * 초보자 가이드:
 * - imageUrl 은 백엔드 상대경로(/uploads/equip-inspect-items/...)일 수 있어 API base 기준으로 정규화한다
 * - 키오스크/설비점검 모두 터치/마우스로 썸네일을 눌러 확대한다
 * - 이미지가 없으면 ImageOff 플레이스홀더를 표시해 레이아웃 높이를 유지한다
 */
import { useState, useCallback } from 'react';
import { ImageOff } from 'lucide-react';
import { resolveBackendFileUrl } from '@/utils/file-url';

interface InspectItemImageProps {
  imageUrl?: string | null;
  alt: string;
  /** 썸네일 한 변 크기(px) */
  size?: number;
}

export default function InspectItemImage({ imageUrl, alt, size = 44 }: InspectItemImageProps) {
  const [zoomed, setZoomed] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = resolveBackendFileUrl(imageUrl);

  const openZoom = useCallback(() => {
    if (src && !errored) setZoomed(true);
  }, [src, errored]);

  const closeZoom = useCallback(() => setZoomed(false), []);

  if (!src || errored) {
    return (
      <span
        className="inline-flex items-center justify-center rounded border border-dashed border-border bg-surface text-text-muted"
        style={{ width: size, height: size }}
        title="등록된 사진 없음"
      >
        <ImageOff className="w-4 h-4" />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openZoom}
        className="inline-block rounded border border-border bg-white dark:bg-slate-800 overflow-hidden hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary transition"
        style={{ width: size, height: size }}
        title="클릭하면 크게 보기"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      </button>

      {zoomed && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6 cursor-zoom-out"
          onClick={closeZoom}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} 확대 보기`}
        >
          <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[80vh] max-w-[80vw] object-contain rounded-lg bg-white dark:bg-slate-900 shadow-2xl"
            />
            <p className="text-sm text-white/90 font-medium">{alt}</p>
            <button
              type="button"
              onClick={closeZoom}
              className="px-4 py-1.5 rounded-lg bg-white/15 text-white text-sm hover:bg-white/25 transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
