/**
 * @file src/hooks/useScanInputFocus.ts
 * @description 바코드 스캔 입력창이 "항상 포커스"를 유지하도록 하는 훅.
 *
 * 초보자 가이드:
 * - 바코드 스캐너는 포커스된 입력창에 키 입력을 보낸다. 포커스를 잃으면 스캔이 먹히지 않는다.
 * - document 레벨 focusout/click 으로 처리하므로, 리렌더로 input DOM 노드가 교체돼도 항상 현재 노드를 포커스한다.
 * - 동작:
 *   1) 활성화 직후 즉시 포커스
 *   2) 포커스가 빠질 때, 버튼/다른 입력 등 "인터랙티브 요소"로 이동한 경우가 아니면 다시 포커스
 *   3) primary 입력(주 스캔창): 모달이 떠 있지 않을 때, 빈 영역 클릭으로 포커스를 잃어도 회수
 * - primary가 아닌 입력(모달 등)은 자기 입력에서 빠진 경우만 회수하고, 모달이 떠 있으면 주 입력은 양보한다.
 */
import { useEffect, type RefObject } from 'react';

const INTERACTIVE_SELECTOR = 'input, textarea, select, button, a, [role="button"], [tabindex]';
const DIALOG_SELECTOR = '[role="dialog"]';

interface ScanFocusOptions {
  /** 주 스캔 입력(키오스크 상단 바코드 등). 모달이 없을 때 빈 곳 클릭에도 포커스를 회수한다. */
  primary?: boolean;
}

export function useScanInputFocus(
  ref: RefObject<HTMLInputElement | null>,
  active: boolean = true,
  options: ScanFocusOptions = {},
): void {
  const { primary = false } = options;

  useEffect(() => {
    if (!active) return;

    const focus = () => {
      const node = ref.current;
      if (node && document.body.contains(node) && document.activeElement !== node) node.focus();
    };

    // 활성화 직후 초기 포커스
    const initial = window.setTimeout(focus, 50);

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as HTMLElement | null;
      // 버튼·다른 입력 등 의도적인 인터랙션으로 이동하면 회수하지 않음
      if (next && next.closest(INTERACTIVE_SELECTOR)) return;
      if (primary) {
        // 주 입력: 모달이 떠 있으면 모달 입력에 양보
        if (document.querySelector(DIALOG_SELECTOR)) return;
      } else if (event.target !== ref.current) {
        // 모달 등: 자기 입력에서 빠진 경우만 회수
        return;
      }
      window.setTimeout(focus, 0);
    };
    document.addEventListener('focusout', onFocusOut);

    // 주 입력은 빈 영역 클릭으로 포커스를 잃은 경우도 회수
    let onClick: ((e: MouseEvent) => void) | undefined;
    if (primary) {
      onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest(INTERACTIVE_SELECTOR)) return;        // 버튼/입력 클릭은 무시
        if (target.closest(DIALOG_SELECTOR)) return;             // 모달 내부 클릭 무시
        if (document.querySelector(DIALOG_SELECTOR)) return;     // 모달이 떠 있으면 양보
        window.setTimeout(focus, 0);
      };
      document.addEventListener('click', onClick);
    }

    return () => {
      window.clearTimeout(initial);
      document.removeEventListener('focusout', onFocusOut);
      if (onClick) document.removeEventListener('click', onClick);
    };
  }, [ref, active, primary]);
}
