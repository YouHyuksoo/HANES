'use client';

import { useState } from 'react';
import { Button, ConfirmModal } from '@/components/ui';

export default function RowDeleteButton({ onConfirm, label = '삭제', title = '행 삭제', message = '선택한 행을 삭제하시겠습니까? 이 작업은 현재 DRAFT에만 반영됩니다.' }: { onConfirm: () => Promise<void>; label?: string; title?: string; message?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await onConfirm();
            setOpen(false);
          } finally {
            setBusy(false);
          }
        }}
        isLoading={busy}
        variant="danger"
        title={title}
        message={message}
      />
    </>
  );
}
