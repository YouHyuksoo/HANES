'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';

export default function RevisionCreateModal({ isOpen, onClose, onConfirm, busy }: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string, description: string) => Promise<unknown>; busy: boolean }) {
  const [reason, setReason] = useState(''); const [description, setDescription] = useState('');
  return <Modal isOpen={isOpen} onClose={onClose} title="새 Revision 생성" footer={<><Button variant="secondary" onClick={onClose}>취소</Button><Button disabled={!reason.trim() || !description.trim() || busy} onClick={async () => { const result = await onConfirm(reason, description); if (result !== undefined) onClose(); }}>생성</Button></>}><div className="space-y-4"><Input label="개정 사유" value={reason} onChange={(event) => setReason(event.target.value)} fullWidth /><label className="block text-sm font-medium text-text">변경 내용<textarea className="mt-1 min-h-32 w-full rounded-md border border-border bg-background p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /></label><p className="text-xs text-text-muted">발행본은 그대로 보존되고 행과 참여자가 새 DRAFT로 복제됩니다.</p></div></Modal>;
}
