/**
 * @file src/components/worker/WorkerPhotoCropper.tsx
 * @description 작업자 사진 크롭 모달 - react-easy-crop 기반
 *
 * 초보자 가이드:
 * 1. **파일 선택**: 모달 내에서 이미지 파일을 선택
 * 2. **크롭 UI**: react-easy-crop으로 드래그 이동 + 핀치/스크롤 줌
 * 3. **적용**: Canvas로 크롭 영역을 잘라 DataURL 반환
 *
 * 참조: C:\Project\wbsmaster\src\components\ui\ImageCropper.tsx
 */
"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { ZoomIn, ZoomOut, ImagePlus } from "lucide-react";
import { Modal, Button } from "@/components/ui";

interface WorkerPhotoCropperProps {
  /** 크롭할 이미지 DataURL (외부에서 전달 시) */
  imageSrc?: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** 크롭 완료 시 DataURL 반환 */
  onCrop: (croppedDataUrl: string) => void;
}

/** 이미지 URL → HTMLImageElement 로드 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

/** Canvas로 크롭 영역 잘라내기 */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  return canvas.toDataURL("image/jpeg", 0.9);
}

function WorkerPhotoCropper({ imageSrc: externalSrc, isOpen, onClose, onCrop }: WorkerPhotoCropperProps) {
  const { t } = useTranslation();
  const [internalSrc, setInternalSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeSrc = externalSrc || internalSrc;

  /** 파일 선택 시 이미지 로드 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setInternalSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /** 크롭 영역 변경 완료 */
  const onCropCompleteInternal = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  /** 적용 버튼 */
  const handleComplete = async () => {
    if (!activeSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedUrl = await getCroppedImg(activeSrc, croppedAreaPixels);
      onCrop(croppedUrl);
    } catch (error) {
      console.error("크롭 실패:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  /** 모달 닫기 시 상태 초기화 */
  const handleClose = useCallback(() => {
    setInternalSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("master.worker.cropTitle")} size="md">
      <div className="space-y-4">
        {!activeSrc ? (
          /* 파일 선택 화면 */
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-28 h-28 rounded-full bg-background border-2 border-dashed border-border flex items-center justify-center">
              <ImagePlus className="w-10 h-10 text-text-muted" />
            </div>
            <p className="text-sm text-text-muted text-center">
              {t("master.worker.cropSelectDesc")}
            </p>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <span className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors text-base font-medium">
                <ImagePlus className="w-5 h-5" />
                {t("master.worker.cropSelectBtn")}
              </span>
            </label>
          </div>
        ) : (
          /* 크롭 화면 */
          <div className="space-y-4">
            {/* 크롭 영역 */}
            <div className="relative h-72 bg-black rounded-lg overflow-hidden">
              <Cropper
                image={activeSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropCompleteInternal}
              />
            </div>

            {/* 줌 슬라이더 */}
            <div className="flex items-center gap-3">
              <ZoomOut className="w-5 h-5 text-text-muted shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-background"
              />
              <ZoomIn className="w-5 h-5 text-text-muted shrink-0" />
            </div>

            {/* 다른 이미지 선택 */}
            <label className="cursor-pointer block text-center">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <span className="text-sm text-primary hover:underline">
                {t("master.worker.cropReselectBtn")}
              </span>
            </label>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex gap-3 pt-2 border-t border-border">
          <Button variant="secondary" onClick={handleClose} className="flex-1 py-3">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleComplete}
            className="flex-1 py-3"
            disabled={!activeSrc || isProcessing}
          >
            {isProcessing ? t("master.worker.cropProcessing") : t("master.worker.cropConfirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default WorkerPhotoCropper;
