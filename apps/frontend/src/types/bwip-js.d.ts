/**
 * @file src/types/bwip-js.d.ts
 * @description bwip-js 바코드 라이브러리 타입 선언 (moduleResolution: bundler 호환)
 */
declare module "bwip-js" {
  interface RenderOptions {
    bcid: string;
    text: string;
    scale?: number;
    width?: number;
    height?: number;
    includetext?: boolean;
    textxalign?: string;
    textsize?: number;
    [key: string]: unknown;
  }

  function toCanvas(
    canvas: HTMLCanvasElement | OffscreenCanvas | string,
    opts: RenderOptions
  ): HTMLCanvasElement | OffscreenCanvas;

  export { toCanvas, RenderOptions };
}
