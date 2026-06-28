"use client";

/**
 * @file src/hooks/useUnsavedGuard.ts
 * @description 우측 슬라이드 폼 패널에서 "저장하지 않은 변경"을 공통 방어하는 훅
 *
 * 사용 패턴:
 * 1. 폼 패널(또는 패널을 품은 page)이 `markDirty(true|false)`로 작성 중 여부를 보고한다.
 *    - 분리 FormPanel: `onDirtyChange` prop으로 markDirty를 전달받아 호출
 *    - 인라인 패널: page 안에서 dirty를 직접 계산해 markDirty 호출
 * 2. 행 클릭/신규/닫기 등 "현재 작성 내용을 버리는 동작"을 `guard(action)`으로 감싼다.
 *    dirty면 확인 모달을 띄우고, 사용자가 확인할 때만 action을 실행한다.
 * 3. page에서 `<ConfirmModal {...guardModalProps} />`를 한 번 렌더한다.
 */

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export function useUnsavedGuard() {
  const { t } = useTranslation();
  const dirtyRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  /** 폼 패널이 작성 중(dirty) 여부를 보고한다. */
  const markDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  /** 현재 작성 내용을 버리는 동작을 가드한다. dirty면 확인 모달, 아니면 즉시 실행. */
  const guard = useCallback((action: () => void) => {
    if (dirtyRef.current) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }, []);

  const handleConfirm = useCallback(() => {
    dirtyRef.current = false;
    setPendingAction((action) => {
      action?.();
      return null;
    });
  }, []);

  const handleCancel = useCallback(() => setPendingAction(null), []);

  const guardModalProps = {
    isOpen: pendingAction !== null,
    onClose: handleCancel,
    onConfirm: handleConfirm,
    variant: "danger" as const,
    title: t("common.unsavedTitle", "저장하지 않은 변경"),
    message: t(
      "common.unsavedMessage",
      "작성 중인 내용이 있습니다. 저장하지 않고 이동하면 변경사항이 사라집니다. 계속하시겠습니까?",
    ),
    confirmText: t("common.discardAndContinue", "계속"),
  };

  return { markDirty, guard, guardModalProps };
}
