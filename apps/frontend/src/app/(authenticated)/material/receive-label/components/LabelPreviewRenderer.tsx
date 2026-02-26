'use client';

/**
 * @file components/LabelPreviewRenderer.tsx
 * @description 인쇄용 라벨 렌더링 (숨김 영역) - 브라우저 인쇄 시 사용
 *
 * 초보자 가이드:
 * 1. 화면에 보이지 않는 영역에 라벨 HTML을 렌더링
 * 2. 브라우저 인쇄 시 이 영역의 innerHTML을 새 창에 복사하여 인쇄
 * 3. 바코드, 품목코드, 품목명, 서브텍스트를 라벨 디자인에 맞게 배치
 */
import { forwardRef } from 'react';
import BarcodeCanvas from '../../../master/label/components/BarcodeCanvas';
import { LabelDesign } from '../../../master/label/types';

/** 라벨 아이템 데이터 */
export interface LabelItem {
  key: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  sub: string;
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
  ({ items, design, visible }, ref) => {
    if (!visible || items.length === 0) return null;

    return (
      <div className="fixed left-[-9999px] top-0">
        <div ref={ref} className="flex flex-wrap gap-1">
          {items.map((item) => (
            <div
              key={item.key}
              className="border border-dashed border-gray-300 relative overflow-hidden"
              style={{
                width: `${design.labelWidth}mm`,
                height: `${design.labelHeight}mm`,
              }}
            >
              {/* 바코드 */}
              <div
                className="absolute flex items-center justify-center"
                style={{
                  left: `${(design.barcode.x / design.labelWidth) * 100}%`,
                  top: `${(design.barcode.y / design.labelHeight) * 100}%`,
                  transform: 'translateX(-50%)',
                  width: `${(design.barcode.size / design.labelWidth) * 100}%`,
                }}
              >
                <BarcodeCanvas
                  value={item.lotNo}
                  format={design.barcode.format}
                />
              </div>

              {/* 코드 텍스트 (품목코드) */}
              {design.codeText.enabled && (
                <div
                  className="absolute w-full truncate"
                  style={{
                    top: `${(design.codeText.y / design.labelHeight) * 100}%`,
                    fontSize: `${design.codeText.fontSize * 0.8}px`,
                    fontFamily: design.codeText.fontFamily,
                    fontWeight: design.codeText.bold ? 'bold' : 'normal',
                    textAlign: design.codeText.align,
                    left: 0, right: 0, padding: '0 4px',
                  }}
                >
                  {item.itemCode}
                </div>
              )}

              {/* 명칭 텍스트 (품목명) */}
              {design.nameText.enabled && (
                <div
                  className="absolute w-full truncate text-gray-600"
                  style={{
                    top: `${(design.nameText.y / design.labelHeight) * 100}%`,
                    fontSize: `${design.nameText.fontSize * 0.8}px`,
                    fontFamily: design.nameText.fontFamily,
                    fontWeight: design.nameText.bold ? 'bold' : 'normal',
                    textAlign: design.nameText.align,
                    left: 0, right: 0, padding: '0 4px',
                  }}
                >
                  {item.itemName}
                </div>
              )}

              {/* 서브 텍스트 (거래처 | 입하일) */}
              {design.subText.enabled && (
                <div
                  className="absolute w-full truncate text-gray-400"
                  style={{
                    top: `${(design.subText.y / design.labelHeight) * 100}%`,
                    fontSize: `${design.subText.fontSize * 0.8}px`,
                    fontFamily: design.subText.fontFamily,
                    fontWeight: design.subText.bold ? 'bold' : 'normal',
                    textAlign: design.subText.align,
                    left: 0, right: 0, padding: '0 4px',
                  }}
                >
                  {item.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },
);

LabelPreviewRenderer.displayName = 'LabelPreviewRenderer';

export default LabelPreviewRenderer;
