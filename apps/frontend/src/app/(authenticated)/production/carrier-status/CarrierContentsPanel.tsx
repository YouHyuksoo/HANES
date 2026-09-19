"use client";
/**
 * @file production/carrier-status/CarrierContentsPanel.tsx
 * @description 대차현황 우측 상세 패널 — 대차 1대의 헤더 정보 + 담긴 내용(바코드/품목/수량/적재일시)를 보여준다.
 *
 * 초보자 가이드:
 * 1. 목록에서 행을 클릭하면 carrierNo가 내려오고, GET /production/carriers/:no 로 CarrierStatusView를 조회한다.
 * 2. 상단 액션: 닫기, 이동전표(CarrierSlipPrintModal 재사용 — 전표 재발행 API를 호출한다).
 * 3. 담긴 내용이 0건이면(빈 대차) 안내 문구만 표시한다.
 */
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Printer } from "lucide-react";
import { Button, ComCodeBadge } from "@/components/ui";
import api from "@/services/api";
import { CarrierSlipPrintModal, type CarrierStatusView } from "@/components/shared/carrier";

interface Props {
  carrierNo: string | null;
  onClose: () => void;
}

/** 서버 타임스탬프(ISO)를 "YYYY-MM-DD HH:mm:ss" 로 자른다 */
const fmt = (v?: string | null) => (v ? String(v).replace("T", " ").slice(0, 19) : "-");

export default function CarrierContentsPanel({ carrierNo, onClose }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<CarrierStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);

  const fetchView = useCallback(async () => {
    if (!carrierNo) { setView(null); return; }
    setLoading(true);
    try {
      const res = await api.get(`/production/carriers/${encodeURIComponent(carrierNo)}`);
      setView(res.data?.data ?? null);
    } catch {
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [carrierNo]);

  useEffect(() => { fetchView(); }, [fetchView]);

  if (!carrierNo) return null;

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 상단 액션 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-text font-mono truncate">{carrierNo}</h2>
          {view && <p className="text-xs text-text-muted truncate">{view.carrierType}{view.carrierName ? ` · ${view.carrierName}` : ""}</p>}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={() => setSlipOpen(true)}>
            <Printer className="w-3.5 h-3.5 mr-1" />{t("carrier.slipTitle", "대차 이동전표")}
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-32 text-text-muted">{t("common.loading")}</div>}

      {view && !loading && (
        <>
          {/* 헤더 정보: 상태·품목·지시·다음 공정 */}
          <div className="px-5 py-3 border-b border-border bg-surface-alt/50 flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ComCodeBadge groupCode="CARRIER_STATUS" code={view.status} />
              <span className="text-text-muted">{t("common.partCode")}: <span className="text-text font-medium">{view.itemCode ?? "-"}</span></span>
              <span className="text-text-muted">{t("common.partName")}: <span className="text-text font-medium">{view.itemName ?? "-"}</span></span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-text-muted">{t("production.order.orderNo")}: <span className="text-text font-medium">{view.orderNo ?? "-"}</span></span>
              <span className="text-text-muted">
                {t("carrier.to", "도착 공정")}: <span className="text-text font-medium">{view.nextProcessName ?? view.nextProcessCode ?? t("carrier.toFinal", "최종")}</span>
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-text-muted">
                {t("production.carrierStatus.loadedCount")}: <span className="text-text font-medium tabular-nums">{view.loadedCount}{view.capacity != null ? `/${view.capacity}` : ""}</span>
              </span>
              <span className="text-text-muted">
                {t("production.carrierStatus.totalQty")}: <span className="text-text font-medium tabular-nums">{view.totalQty.toLocaleString()}</span>
              </span>
            </div>
          </div>

          {/* 담긴 내용 */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wide sticky top-0 bg-background border-b border-border">
              {t("production.carrierStatus.contents")}
            </div>
            {view.contents.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-muted">{t("production.carrierStatus.noContents")}</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="text-left font-medium px-5 py-1.5">{t("carrier.barcode", "바코드")}</th>
                    <th className="text-left font-medium px-2 py-1.5">{t("common.partCode")}</th>
                    <th className="text-right font-medium px-2 py-1.5">{t("common.qty", "수량")}</th>
                    <th className="text-left font-medium px-5 py-1.5">{t("carrier.loadedAt", "적재일시")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.contents.map((row) => (
                    <tr key={row.barcode} className="border-b border-border/60">
                      <td className="px-5 py-1.5 font-mono">{row.barcode}</td>
                      <td className="px-2 py-1.5">{row.itemCode}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{row.qty.toLocaleString()}</td>
                      <td className="px-5 py-1.5">{fmt(row.loadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <CarrierSlipPrintModal isOpen={slipOpen} carrierNo={carrierNo} onClose={() => setSlipOpen(false)} />
    </div>
  );
}
