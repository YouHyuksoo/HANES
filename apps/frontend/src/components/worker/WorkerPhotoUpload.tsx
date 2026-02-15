"use client";

/**
 * @file src/components/worker/WorkerPhotoUpload.tsx
 * @description 작업자 사진 업로드 + 크롭 컴포넌트
 *
 * 초보자 가이드:
 * 1. **사진 업로드**: 클릭 또는 드래그&드롭으로 이미지 파일 선택
 * 2. **크롭**: 선택 즉시 크롭 모달이 열려 드래그+줌으로 위치 조정
 * 3. **미리보기**: 크롭 완료된 이미지를 원형 프리뷰로 표시
 */

import { useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Camera, X } from "lucide-react";
import WorkerPhotoCropper from "./WorkerPhotoCropper";

interface WorkerPhotoUploadProps {
  value: string | null;
  onChange: (photoUrl: string | null) => void;
  size?: "sm" | "lg";
}

function WorkerPhotoUpload({ value, onChange, size = "lg" }: WorkerPhotoUploadProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);

  const sizeClass = size === "lg" ? "w-28 h-28" : "w-16 h-16";
  const iconSize = size === "lg" ? "w-8 h-8" : "w-5 h-5";

  /** 파일 → DataURL 변환 후 크롭 모달 열기 */
  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawImage(e.target?.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  /** 크롭 완료 */
  const handleCropDone = useCallback((croppedUrl: string) => {
    onChange(croppedUrl);
    setIsCropOpen(false);
    setRawImage(null);
  }, [onChange]);

  /** 크롭 취소 */
  const handleCropClose = useCallback(() => {
    setIsCropOpen(false);
    setRawImage(null);
  }, []);

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <div
          className={`${sizeClass} relative rounded-full border-2 border-dashed cursor-pointer overflow-hidden transition-colors
            ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-background"}`}
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          {value ? (
            <img src={value} alt="worker" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
              <Camera className={iconSize} />
              {size === "lg" && <span className="text-[10px] mt-1">{t("master.worker.photoUpload")}</span>}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
          >
            <X className="w-3 h-3" />
            {t("master.worker.photoRemove")}
          </button>
        )}
        {!value && size === "lg" && (
          <p className="text-[11px] text-text-muted">{t("master.worker.photoHint")}</p>
        )}
      </div>

      {/* 크롭 모달 */}
      {rawImage && (
        <WorkerPhotoCropper
          imageSrc={rawImage}
          isOpen={isCropOpen}
          onClose={handleCropClose}
          onCrop={handleCropDone}
        />
      )}
    </>
  );
}

export default WorkerPhotoUpload;
