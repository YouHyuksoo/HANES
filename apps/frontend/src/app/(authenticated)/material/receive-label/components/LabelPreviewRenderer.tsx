'use client';

/**
 * @file components/LabelPreviewRenderer.tsx
 * @description 인쇄용 라벨 렌더링 (숨김 영역) - 브라우저 인쇄 시 사용
 *
 * 초보자 가이드:
 * 1. 화면에 보이지 않는 영역에 라벨 HTML을 렌더링
 * 2. 브라우저 인쇄 시 이 영역의 innerHTML을 새 창에 복사하여 인쇄
 * 3. 입하 라벨 표준 형식(80mm x 40mm)으로 배치
 */
import { forwardRef } from 'react';
import MaterialArrivalLabel, { MaterialArrivalLabelItem } from '@/components/material/MaterialArrivalLabel';
import { LabelDesign } from '../../../master/label/types';

/** 라벨 아이템 데이터 */
export interface LabelItem extends MaterialArrivalLabelItem {
  key: string;
}

interface LabelPreviewRendererProps {
  /** 인쇄할 라벨 아이템 목록 */
  items: LabelItem[];
  /** 라벨 디자인 설정 */
  design: LabelDesign;
  /** 인쇄 중 여부 (true일 때만 렌더링) */
  visible: boolean;
}

/**
 * 인쇄용 라벨 렌더링 컴포넌트 (화면 밖 숨김)
 * ref를 통해 외부에서 innerHTML을 읽어 인쇄 창에 전달
 */
const LabelPreviewRenderer = forwardRef<HTMLDivElement, LabelPreviewRendererProps>(
  ({ items, visible }, ref) => {
    if (!visible || items.length === 0) return null;

    return (
      <div className="fixed left-[-9999px] top-0">
        <div ref={ref} className="flex flex-wrap gap-1">
          {items.map((item) => (
            <MaterialArrivalLabel key={item.key} item={item} />
          ))}
        </div>
      </div>
    );
  },
);

LabelPreviewRenderer.displayName = 'LabelPreviewRenderer';

export default LabelPreviewRenderer;
