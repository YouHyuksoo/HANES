/**
 * @file src/stores/improvementRequestStore.ts
 * @description 개선요청 등록 전역 상태 - 선택 모드 ON/OFF, 선택된 요소, 스크린샷
 *
 * 초보자 가이드:
 * 1. isActive: true = 오버레이 선택 모드 활성화
 * 2. selectedElement: 사용자가 클릭한 DOM 요소 정보 (null이면 모달 숨김)
 * 3. screenshot: html2canvas로 캡처한 base64 이미지
 * 4. reset(): 모달 닫기 + 상태 초기화
 */
import { create } from 'zustand';

export interface SelectedElement {
  text: string;
  tagName: string;
}

interface ImprovementRequestState {
  isActive: boolean;
  isCapturing: boolean;
  selectedElement: SelectedElement | null;
  screenshot: string | null;
  activate: () => void;
  deactivate: () => void;
  startCapturing: () => void;
  setSelectedElement: (el: SelectedElement, screenshot: string | null) => void;
  reset: () => void;
}

export const useImprovementRequestStore = create<ImprovementRequestState>((set) => ({
  isActive: false,
  isCapturing: false,
  selectedElement: null,
  screenshot: null,
  activate: () => set({ isActive: true, isCapturing: false, selectedElement: null, screenshot: null }),
  deactivate: () => set({ isActive: false, isCapturing: false }),
  startCapturing: () => set({ isActive: false, isCapturing: true }),
  setSelectedElement: (el, screenshot) =>
    set({ isCapturing: false, isActive: false, selectedElement: el, screenshot }),
  reset: () => set({ isActive: false, isCapturing: false, selectedElement: null, screenshot: null }),
}));
