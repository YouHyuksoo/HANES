/**
 * @file src/app/(authenticated)/master/work-instruction/components/WorkInstructionPreviewPanel.tsx
 * @description 작업지도서 미리보기 오른쪽 슬라이드 패널 (읽기 전용)
 *
 * 초보자 가이드:
 * 1. **미리보기 패널**: 행 클릭 시 오른쪽에 작업지도서 상세 표시
 * 2. **이미지 미리보기**: 이미지 파일은 인라인으로 크게 표시
 * 3. **PDF 미리보기**: PDF 파일은 iframe으로 임베드 표시
 * 4. **편집 전환**: "수정" 버튼 클릭 시 편집 패널로 전환
 */

"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Edit2, FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import api from "@/services/api";
import type { WorkInstruction } from "./WorkInstructionFormPanel";

interface WorkInstructionDetail extends WorkInstruction {
  content?: string;
}

interface Props {
  item: WorkInstruction;
  onClose: () => void;
  onEdit: (item: WorkInstruction) => void;
  animate?: boolean;
}

/** 이미지 확장자 판별 */
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url);

/** PDF 확장자 판별 */
const isPdfUrl = (url: string) => /\.pdf$/i.test(url);

/** 파일 URL을 절대 URL로 변환 */
const resolveFileUrl = (url: string) =>
  url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "")}${url}` : url;

export default function WorkInstructionPreviewPanel({ item, onClose, onEdit, animate = true }: Props) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<WorkInstructionDetail>(item);
  const [loading, setLoading] = useState(false);

  /** 상세 데이터 조회 (content 포함) */
  useEffect(() => {
    if (!item.id) return;
    setLoading(true);
    api.get(`/master/work-instructions/${item.id}`)
      .then((res) => {
        if (res.data?.success) {
          setDetail({ ...item, ...res.data.data });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item.id]);

  /** item이 바뀔 때 즉시 기본 정보 반영 */
  useEffect(() => {
    setDetail((prev) => ({ ...prev, ...item }));
  }, [item]);

  const fileUrl = detail.imageUrl ? resolveFileUrl(detail.imageUrl) : null;

  return (
    <div className={`w-[520px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text truncate mr-2">
          {t("master.workInstruction.preview", "미리보기")}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => onEdit(detail)}>
            <Edit2 className="w-3.5 h-3.5 mr-1" />{t("common.edit")}
          </Button>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
            <X className="w-4 h-4 text-text-muted hover:text-text" />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 기본정보 */}
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-base font-bold text-text mb-1">{detail.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                  Rev {detail.revision}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded ${detail.useYn === "Y" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                  {detail.useYn === "Y" ? t("common.active", "사용") : t("common.inactive", "미사용")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                <InfoRow label={t("common.partCode")} value={detail.partCode} />
                <InfoRow label={t("common.partName")} value={detail.partName || "-"} />
                <InfoRow label={t("master.workInstruction.processCode")} value={detail.processCode || "-"} />
                <InfoRow label={t("master.workInstruction.updatedAt")} value={detail.updatedAt} />
              </div>
            </div>

            {/* 첨부파일 미리보기 */}
            {fileUrl && (
              <div className="px-5 py-3 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-text-muted">{t("master.workInstruction.attachment", "첨부파일")}</h3>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />{t("master.workInstruction.openNewTab", "새 탭에서 열기")}
                  </a>
                </div>

                {isImageUrl(detail.imageUrl!) ? (
                  <div className="border border-border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <img
                      src={fileUrl}
                      alt={detail.title}
                      className="w-full max-h-[400px] object-contain"
                    />
                  </div>
                ) : isPdfUrl(detail.imageUrl!) ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <iframe
                      src={fileUrl}
                      className="w-full h-[400px]"
                      title={detail.title}
                    />
                  </div>
                ) : (
                  <a href={fileUrl} download
                    className="flex items-center gap-3 p-3 border border-border rounded-lg bg-surface hover:bg-surface/80 transition-colors">
                    <FileText className="w-8 h-8 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text truncate">{detail.imageUrl!.split("/").pop()}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{t("master.workInstruction.clickToDownload", "클릭하여 다운로드")}</p>
                    </div>
                    <Download className="w-4 h-4 text-text-muted shrink-0" />
                  </a>
                )}
              </div>
            )}

            {/* 내용 */}
            {detail.content && (
              <div className="px-5 py-3">
                <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.workInstruction.content")}</h3>
                <div className="p-3 bg-surface rounded-lg text-xs text-text leading-relaxed whitespace-pre-wrap">
                  {detail.content}
                </div>
              </div>
            )}

            {/* 첨부파일도 내용도 없는 경우 */}
            {!fileUrl && !detail.content && (
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <FileText className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">{t("master.workInstruction.noContent", "등록된 내용이 없습니다.")}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** 정보 행 컴포넌트 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-text-muted">{label}: </span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}
