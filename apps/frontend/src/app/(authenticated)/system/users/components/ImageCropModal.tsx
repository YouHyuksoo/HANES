/**
 * @file src/app/(authenticated)/system/users/components/ImageCropModal.tsx
 * @description 사용자 사진 크롭 모달 - react-easy-crop 기반 원형 크롭
 *
 * 초보자 가이드:
 * 1. **Cropper**: 이미지를 드래그/줌/회전하여 원형으로 크롭
 * 2. **onCropComplete**: 크롭 완료 시 Blob 반환
 * 3. **canvas**: 크롭 영역을 캔버스에 그려 Blob으로 변환
 */

"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedImage: Blob) => void;
}

export default function ImageCropModal({ isOpen, onClose, imageSrc, onCropComplete }: ImageCropModalProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropAreaChange = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Canvas context not available");

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.putImageData(
      data,
      0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
      0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, "image/jpeg", 0.95);
    });
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropComplete(croppedImage);
      onClose();
    } catch (error) {
      console.error("Crop failed:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("system.users.photoCrop")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleConfirm}>{t("common.confirm")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative w-full h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropAreaChange={onCropAreaChange}
          />
        </div>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setZoom(Math.max(1, zoom - 0.1))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <ZoomOut className="w-5 h-5" />
          </button>
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-32" />
          <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={() => setRotation((prev) => (prev + 90) % 360)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ml-4" title={t("system.users.rotate")}>
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
