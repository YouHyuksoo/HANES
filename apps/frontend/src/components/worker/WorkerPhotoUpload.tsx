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
import { Camera, X, Loader2 } from "lucide-react";
import api from "@/services/api";

interface WorkerPhotoUploadProps {
  value: string | null;
  onChange: (photoUrl: string | null) => void;
  size?: "sm" | "lg";
}

function WorkerPhotoUpload({ value, onChange, size = "lg" }: WorkerPhotoUploadProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const sizeClass = size === "lg" ? "w-28 h-28" : "w-16 h-16";
  const iconSize = size === "lg" ? "w-8 h-8" : "w-5 h-5";

  /** 파일 선택 → 서버 업로드 → URL 반환 */
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/master/workers/upload-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.data?.url;
      if (url) onChange(url);
    } catch {
      /* api 인터셉터에서 에러 처리 */
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  /** 사진 URL을 위한 src 생성 */
  const imgSrc = value?.startsWith("/uploads")
    ? `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || ""}${value}`
    : value;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${sizeClass} relative rounded-full border-2 border-dashed cursor-pointer overflow-hidden transition-colors
          ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-background"}`}
        onClick={() => !uploading && fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        {uploading ? (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <Loader2 className={`${iconSize} animate-spin`} />
          </div>
        ) : value ? (
          <img src={imgSrc ?? ""} alt="worker" className="w-full h-full object-cover" />
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
  );
}

export default WorkerPhotoUpload;
