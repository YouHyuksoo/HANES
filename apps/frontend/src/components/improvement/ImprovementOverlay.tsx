"use client";

/**
 * @file src/components/improvement/ImprovementOverlay.tsx
 * @description 개선요청 선택 모드 오버레이 — 커서 아래 요소를 하이라이트하고 클릭 시 캡처
 *
 * 초보자 가이드:
 * 1. 전체화면 반투명 div가 마우스 이벤트를 캡처한다
 * 2. mousemove: 오버레이 pointer-events를 잠시 none으로 바꿔 실제 요소를 탐지
 * 3. click: 동일 방식으로 요소 탐지 → 스크린샷 촬영 → setSelectedElement 호출
 * 4. 스크린샷 촬영 중에는 오버레이를 visibility:hidden으로 숨겨 화면에 포함되지 않게 함
 */
import { useEffect, useRef } from "react";
import { useImprovementRequestStore } from "@/stores/improvementRequestStore";

const SKIP_TAGS = ["HTML", "BODY", "SCRIPT", "STYLE", "HEAD"];

/**
 * 개선요청 선택 모드 오버레이 컴포넌트
 *
 * 전체화면을 덮는 반투명 오버레이를 렌더링하여 사용자가 화면의 특정 요소를
 * 클릭하면 해당 요소 정보와 스크린샷을 캡처해 개선요청 스토어에 저장한다.
 */
export default function ImprovementOverlay() {
  const { setSelectedElement, deactivate, startCapturing } = useImprovementRequestStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const highlightedElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    /** 현재 하이라이트된 요소의 아웃라인을 제거한다 */
    const clearHighlight = () => {
      if (highlightedElRef.current) {
        highlightedElRef.current.style.outline = "";
        highlightedElRef.current.style.outlineOffset = "";
        highlightedElRef.current = null;
      }
    };

    /**
     * 오버레이 pointer-events를 잠시 none으로 바꿔 실제 DOM 요소를 탐지한다.
     * SKIP_TAGS에 해당하는 요소는 선택 대상에서 제외한다.
     */
    const getTargetElement = (x: number, y: number): HTMLElement | null => {
      overlay.style.pointerEvents = "none";
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      overlay.style.pointerEvents = "auto";
      if (!el) return null;
      if (SKIP_TAGS.includes(el.tagName)) return null;
      return el;
    };

    /** 마우스 이동 시 커서 아래 요소에 오렌지 아웃라인을 표시한다 */
    const handleMouseMove = (e: MouseEvent) => {
      const target = getTargetElement(e.clientX, e.clientY);
      if (target === highlightedElRef.current) return;

      clearHighlight();

      if (target) {
        highlightedElRef.current = target;
        target.style.outline = "2px solid #f97316";
        target.style.outlineOffset = "2px";
      }
    };

    /**
     * 클릭 시 요소 탐지 → 하이라이트 제거 → 오버레이 숨김 →
     * html2canvas 스크린샷 촬영 → setSelectedElement 호출
     */
    const handleClick = async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = getTargetElement(e.clientX, e.clientY);
      const elementInfo = {
        text: target?.textContent?.trim().slice(0, 500) ?? "",
        tagName: target?.tagName.toLowerCase() ?? "unknown",
      };

      clearHighlight();
      overlay.style.visibility = "hidden";
      startCapturing();

      let screenshot: string | null = null;
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(document.body, {
          scale: 0.5,
          useCORS: true,
          logging: false,
        });
        screenshot = canvas.toDataURL("image/jpeg", 0.7);
      } catch (err) {
        console.warn("[ImprovementOverlay] 스크린샷 실패, 스크린샷 없이 진행:", err);
      }

      setSelectedElement(elementInfo, screenshot);
    };

    /** ESC 키 입력 시 선택 모드를 비활성화한다 */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearHighlight();
        deactivate();
      }
    };

    overlay.addEventListener("mousemove", handleMouseMove);
    overlay.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearHighlight();
      overlay.removeEventListener("mousemove", handleMouseMove);
      overlay.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setSelectedElement, deactivate, startCapturing]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40 bg-black/20 cursor-crosshair"
      style={{ pointerEvents: "auto" }}
    />
  );
}
