/**
 * @file src/lib/utils.ts
 * @description
 * 유틸리티 함수 모음입니다.
 * clsx와 tailwind-merge를 조합하여 조건부 클래스명을 처리합니다.
 *
 * 초보자 가이드:
 * 1. **cn 함수**: 여러 클래스명을 조건부로 조합
 * 2. **clsx**: 조건부 클래스명 처리 (falsy 값 무시)
 * 3. **tailwind-merge**: Tailwind 클래스 충돌 해결
 *
 * 사용 예시:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 조건부 클래스명을 조합하고 Tailwind 클래스 충돌을 해결합니다.
 * @param inputs - 클래스명 배열 (문자열, 객체, 배열 모두 가능)
 * @returns 병합된 클래스명 문자열
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
