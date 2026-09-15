'use client';

/**
 * @file components/material/issue-from-request/SplitLabelSequence.tsx
 * @description 분할 결과 라벨을 원본 LOT 그룹 단위로 순차 미리보기/출력한다.
 *
 * MatLabelPreviewModal 은 단일 arrivalNo / itemName 만 받으므로 여러 품목의 분할 결과를
 * 하나로 합칠 수 없다. 그래서 그룹을 하나씩 넘기고 진행 상황을 표시한다.
 */
import { useState } from 'react';
import MatLabelPreviewModal from '@/components/material/MatLabelPreviewModal';

export interface SplitGroup {
  sourceMatUid: string;
  sourceLotNo?: string;
  itemCode: string;
  itemName: string;
  arrivalNo: string | null;
  results: Array<{ matUid: string; qty: number }>;
  label: {
    arrivalNo: string;
    serials: Array<{ matUid: string; initQty: number; arrivalSeq: number; itemCode: string }>;
  };
}

interface Props {
  groups: SplitGroup[];
  onClose: () => void;
}

export default function SplitLabelSequence({ groups, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const group = groups[index];

  if (!group) return null;

  const handleClose = () => {
    if (index + 1 < groups.length) {
      setIndex(index + 1);
      return;
    }
    setIndex(0);
    onClose();
  };

  return (
    // itemName 은 라벨에 그대로 인쇄되는 필드다. 그룹 진행 표시("1/2" 등)를 여기에 섞으면
    // 실제 자재 라벨의 품목명이 오염되므로 원본 itemName 을 그대로 넘긴다.
    <MatLabelPreviewModal
      isOpen
      data={group.label}
      itemName={group.itemName}
      onClose={handleClose}
    />
  );
}
