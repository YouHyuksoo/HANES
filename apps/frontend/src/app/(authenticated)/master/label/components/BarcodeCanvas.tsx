"use client";

/**
 * @file src/app/(authenticated)/master/label/components/BarcodeCanvas.tsx
 * @description 바코드 렌더링 캔버스 - bwip-js로 QR/DataMatrix/Code39/Code128 렌더링
 *
 * 초보자 가이드:
 * 1. **bwip-js**: 100+ 바코드 형식을 지원하는 라이브러리
 * 2. **canvas**: 바코드를 캔버스에 렌더링 후 표시
 * 3. **format**: qrcode, datamatrix, code39, code128 중 선택
 */
import { useEffect, useRef } from "react";
import { BarcodeFormat } from "../types";

interface BarcodeCanvasProps {
  value: string;
  format: BarcodeFormat;
}

/** bwip-js bcid 매핑 */
const formatMap: Record<BarcodeFormat, string> = {
  qrcode: "qrcode",
  datamatrix: "datamatrix",
  code39: "code39",
  code128: "code128",
};

export default function BarcodeCanvas({ value, format }: BarcodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    let cancelled = false;

    (async () => {
      try {
        // 동적 import로 브라우저 전용 bwip-js 로드
        const bwipjs = await import("bwip-js");
        if (cancelled || !canvasRef.current) return;

        const is2D = format === "qrcode" || format === "datamatrix";
        bwipjs.toCanvas(canvasRef.current, {
          bcid: formatMap[format],
          text: value,
          scale: 3,
          ...(is2D
            ? { width: 25, height: 25 }
            : { width: 40, height: 12, textxalign: "center", includetext: true }),
        });
      } catch {
        if (cancelled || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          canvasRef.current.width = 120;
          canvasRef.current.height = 40;
          ctx.clearRect(0, 0, 120, 40);
          ctx.font = "11px sans-serif";
          ctx.fillStyle = "#999";
          ctx.textAlign = "center";
          ctx.fillText("Barcode Error", 60, 24);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [value, format]);

  return <canvas ref={canvasRef} className="max-w-full" />;
}
