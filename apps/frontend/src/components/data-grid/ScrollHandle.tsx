/**
 * @file src/components/data-grid/ScrollHandle.tsx
 * @description DataGrid 좌/우 스크롤 핸들 컴포넌트
 *
 * 초보자 가이드:
 * 1. **스크롤 핸들**: 테이블 양쪽 가장자리에 hover 시 나타나는 화살표 영역
 * 2. 마우스를 올리면 해당 방향으로 자동 스크롤이 시작됨
 * 3. 마우스를 벗어나면 스크롤이 멈춤
 * 4. `direction`이 'left'이면 왼쪽으로, 'right'이면 오른쪽으로 스크롤
 * 5. 내부적으로 setInterval을 사용하여 부드러운 스크롤 구현
 */
import { RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** ScrollHandle 컴포넌트 props */
export interface ScrollHandleProps {
  /** 스크롤 방향 */
  direction: 'left' | 'right';
  /** 스크롤 대상 컨테이너의 ref */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

/**
 * 스크롤 핸들 — 테이블 양쪽 가장자리에서 hover 시 자동 스크롤
 *
 * @example
 * ```tsx
 * <ScrollHandle direction="left" scrollContainerRef={scrollContainerRef} />
 * <ScrollHandle direction="right" scrollContainerRef={scrollContainerRef} />
 * ```
 */
export function ScrollHandle({ direction, scrollContainerRef }: ScrollHandleProps) {
  const isLeft = direction === 'left';

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (isLeft && container.scrollLeft <= 0) return;
    if (!isLeft) {
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScroll) return;
    }

    const id = setInterval(() => {
      if (!container) return;
      if (isLeft) {
        if (container.scrollLeft <= 0) { clearInterval(id); return; }
        container.scrollLeft -= 8;
      } else {
        const max = container.scrollWidth - container.clientWidth;
        if (container.scrollLeft >= max) { clearInterval(id); return; }
        container.scrollLeft += 8;
      }
    }, 16);
    (e.currentTarget as HTMLElement).dataset.scrollId = String(id);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const id = (e.currentTarget as HTMLElement).dataset.scrollId;
    if (id) clearInterval(Number(id));
  };

  const Icon = isLeft ? ChevronLeft : ChevronRight;
  const positionClass = isLeft ? 'left-0' : 'right-0';
  const gradientClass = isLeft
    ? 'bg-gradient-to-r from-black/15 dark:from-white/15 to-transparent rounded-l-[var(--radius)]'
    : 'bg-gradient-to-l from-black/15 dark:from-white/15 to-transparent rounded-r-[var(--radius)]';

  return (
    <div
      className={`absolute ${positionClass} top-0 bottom-0 w-4 z-20 cursor-pointer opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`h-full w-full flex items-center justify-center ${gradientClass}`}>
        <Icon className="w-3.5 h-3.5 text-text-muted" />
      </div>
    </div>
  );
}
