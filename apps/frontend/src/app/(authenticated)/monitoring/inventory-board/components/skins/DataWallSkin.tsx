"use client";

/**
 * @file .../inventory-board/components/skins/DataWallSkin.tsx
 * @description 재고 스킨 C "데이터 월" — 다크 편집(신문 1면 타이포). 초대형 안전재고 미달 건수 +
 *              부족수량 랭킹 + 하단 기한 문제 LOT 스트립(D-day). 레드 포인트 하나.
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { holdReasonKey, type InventorySkinProps } from "../types";

const RED = "#f0402c";

export default function DataWallSkin({ kpi, shortages, expiry, holds, updatedAt }: InventorySkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const shortageCount = kpi?.shortageCount ?? 0;
  const maxShortage = Math.max(1, ...shortages.map((s) => s.shortage));
  const holdTop = holds.slice(0, 3);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#14120e] text-[#ece7da]">
      <style>{`
        @keyframes idw-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .idw-disp { font-family: 'Anton', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 마스트헤드 */}
      <div className="flex items-baseline justify-between px-12 pt-6 pb-3.5 border-b-[6px] border-[#ece7da] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="text-4xl font-black">{t("menu.monitoring.invBoard")}</span>
          <span className="inline-flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full" style={{ background: RED, animation: "idw-blink 1.6s infinite" }} />
            <span className="font-mono text-base tracking-[0.3em]" style={{ color: RED }}>LIVE</span>
          </span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="font-mono text-base text-[#8d887c]">{clock?.date ?? ""}</span>
          <span className="idw-disp text-5xl">{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 초대형 안전재고 미달 건수 */}
        <div className="w-[40%] border-r-2 border-[#ece7da] flex flex-col px-12 pt-6 pb-8">
          <div className="text-lg font-bold tracking-[0.3em] text-[#8d887c]">{t("monitoring.board.inventory.shortageTitle")}</div>
          <div className="flex items-baseline -mt-2">
            <span className="idw-disp leading-none tracking-tight text-[15rem] 2xl:text-[18rem]" style={{ color: shortageCount > 0 ? RED : undefined }}>
              {shortageCount}
            </span>
            <span className="text-3xl font-black ml-4 text-[#8d887c]">{t("monitoring.board.col.item")}</span>
          </div>
          <div className="flex mt-8 border-t-2 border-[#ece7da]">
            <div className="flex-1 py-4 border-r border-[#3a352c]">
              <div className="text-sm tracking-[0.2em]" style={{ color: (kpi?.expiredCount ?? 0) > 0 ? RED : "#8d887c" }}>{t("monitoring.board.inventory.expired")}</div>
              <div className="idw-disp text-6xl" style={{ color: (kpi?.expiredCount ?? 0) > 0 ? RED : undefined }}>{kpi?.expiredCount ?? 0}</div>
            </div>
            <div className="flex-1 py-4 pl-7 border-r border-[#3a352c]">
              <div className="text-sm tracking-[0.2em] text-[#8d887c] whitespace-nowrap truncate">{t("monitoring.board.inventory.nearExpiry")}</div>
              <div className="idw-disp text-6xl">{kpi?.nearExpiryCount ?? 0}</div>
            </div>
            <div className="flex-1 py-4 pl-7">
              <div className="text-sm tracking-[0.2em] text-[#8d887c]">{t("monitoring.board.inventory.hold")}</div>
              <div className="idw-disp text-6xl">{kpi?.holdCount ?? 0}</div>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-3.5 flex-wrap">
            <span className="bg-[#ece7da] text-[#14120e] text-lg font-bold px-4 py-1.5 tracking-[0.1em]">
              {t("monitoring.board.inventory.todayInOutSub")} {kpi?.inCount ?? 0} / {kpi?.outCount ?? 0}
            </span>
            {holdTop.map((h) => {
              const k = holdReasonKey(h.reason);
              return (
                <span key={`${h.kind}:${h.ref}:${h.reason}`} className="border-2 border-[#ece7da] text-lg font-bold px-3.5 py-1 tracking-[0.05em] max-w-full truncate">
                  {k ? t(k) : h.reason} · {h.itemName ?? h.itemCode} {h.qty.toLocaleString()}
                </span>
              );
            })}
          </div>
        </div>

        {/* 우: 부족수량 랭킹 */}
        <div className="flex-1 flex flex-col min-w-0 px-12 pt-6 pb-4">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-lg font-bold tracking-[0.3em] text-[#8d887c]">{t("monitoring.board.inventory.shortageQty")}</span>
            <span className="font-mono text-sm text-[#8d887c]">{t("monitoring.board.updatedAt")} {updatedAt}</span>
          </div>

          <div className="flex-1 flex flex-col justify-evenly min-h-0">
            {shortages.length === 0 ? (
              <div className="text-2xl text-[#8d887c] text-center">{t("monitoring.board.inventory.noShortage")}</div>
            ) : (
              shortages.slice(0, 6).map((s, i) => (
                <div key={s.itemCode} className="border-b border-[#3a352c] last:border-b-0 py-2.5">
                  <div className="flex items-baseline gap-6">
                    <span className="idw-disp text-4xl w-14" style={{ color: RED }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 min-w-0 text-3xl font-black leading-tight truncate">{s.itemName ?? s.itemCode}</span>
                    <span className="font-mono text-base text-[#8d887c]">{s.itemCode}</span>
                    <span className="font-mono text-lg text-[#8d887c] tabular-nums w-44 text-right">
                      {s.qty.toLocaleString()} / {s.safetyStock.toLocaleString()}
                    </span>
                    <span className="idw-disp text-5xl w-36 text-right" style={{ color: RED }}>-{s.shortage.toLocaleString()}</span>
                  </div>
                  <div className="ml-20 mt-1.5 h-1.5 bg-[#2a2721]">
                    <div className="h-full" style={{ width: `${Math.max(2, (s.shortage / maxShortage) * 100)}%`, background: RED }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 하단: 기한 문제 LOT 스트립 */}
      <div className="flex items-stretch border-t-2 border-[#ece7da] flex-shrink-0">
        <div className="px-12 py-3 flex items-center border-r border-[#3a352c]">
          <span className="text-base font-bold tracking-[0.3em] text-[#8d887c] whitespace-nowrap">{t("monitoring.board.inventory.expiryTitle")}</span>
        </div>
        <div className="flex-1 flex divide-x divide-[#3a352c] min-w-0">
          {expiry.length === 0 ? (
            <div className="flex-1 px-6 py-3 flex items-center text-xl text-[#8d887c]">{t("monitoring.board.inventory.noExpiry")}</div>
          ) : (
            expiry.slice(0, 6).map((e) => {
              const expired = e.daysLeft < 0;
              return (
                <div key={e.matUid} className="flex-1 min-w-0 px-4 py-2.5 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold truncate max-w-full">{e.itemName ?? e.itemCode}</span>
                  <span className="font-mono text-xs text-[#8d887c] truncate max-w-full">{e.matUid} · {e.qty.toLocaleString()}</span>
                  <span className="idw-disp text-3xl leading-tight" style={{ color: expired ? RED : undefined }}>
                    {expired
                      ? t("monitoring.board.inventory.expiredDays", { days: Math.abs(e.daysLeft) })
                      : t("monitoring.board.inventory.daysLeft", { days: e.daysLeft })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
