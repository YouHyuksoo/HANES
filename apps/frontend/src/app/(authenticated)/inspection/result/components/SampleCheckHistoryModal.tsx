"use client";

/**
 * @file inspection/result/components/SampleCheckHistoryModal.tsx
 * @description 양불마스터 대조 이력 — 작업지시·검사유형 기준, 시도마다 쌓인 기록을 모두 보여준다.
 *
 * 초보자 가이드:
 * 1. 재대조는 갱신이 아니라 새 기록이라 NG 시도와 재대조 PASS가 모두 남는다.
 * 2. 행을 누르면 견본별 기대결과/실제결과/판정을 펼쳐 본다.
 * 3. 기록은 수정·삭제하지 않는다(증적).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ComCodeBadge, Modal } from "@/components/ui";
import api from "@/services/api";

interface SampleCheckHistoryItem {
  seqNo: number;
  sampleCode: string;
  sampleType: string;
  expectedResult: string;
  actualResult: string;
  result: string;
  remark: string | null;
}

interface SampleCheckHistoryRow {
  checkNo: string;
  equipCode: string;
  workDate: string;
  shiftCode: string;
  overallResult: string;
  checkerId: string | null;
  checkedAt: string | null;
  createdBy: string | null;
  items: SampleCheckHistoryItem[];
}

interface SampleCheckHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNo: string;
  inspectType: "CONTINUITY" | "TERMINAL";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SampleCheckHistoryModal({
  isOpen, onClose, orderNo, inspectType,
}: SampleCheckHistoryModalProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SampleCheckHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/continuity-inspect/sample-check/history", {
        params: { orderNo, inspectType },
      });
      setRows(res.data?.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orderNo, inspectType]);

  useEffect(() => {
    if (!isOpen) return;
    setExpanded(null);
    void load();
  }, [isOpen, load]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={t("inspection.result.sampleCheck.historyTitle")}>
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
        {!loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            {t("inspection.result.sampleCheck.historyEmpty")}
          </p>
        )}
        {rows.map((row) => {
          const isOpenRow = expanded === row.checkNo;
          const passed = row.overallResult === "PASS";
          return (
            <div key={row.checkNo} className="rounded border border-border">
              <button
                type="button"
                onClick={() => setExpanded(isOpenRow ? null : row.checkNo)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs hover:border-primary"
              >
                <span
                  className={[
                    "rounded border px-1.5 py-0.5 font-semibold",
                    passed
                      ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
                      : "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400",
                  ].join(" ")}
                >
                  {row.overallResult}
                </span>
                <span className="font-mono text-primary">{row.checkNo}</span>
                <span className="text-text-muted">{row.workDate} {row.shiftCode}</span>
                <span className="text-text-muted">{row.equipCode}</span>
                <span className="ml-auto text-text-muted">
                  {row.checkerId ?? "-"} · {formatDateTime(row.checkedAt)}
                </span>
              </button>
              {isOpenRow && (
                <div className="border-t border-border px-3 py-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="py-1 text-left">{t("inspection.result.sampleCheck.sampleCode")}</th>
                        <th className="py-1 text-left">{t("inspection.result.sampleCheck.sampleType")}</th>
                        <th className="py-1 text-left">{t("inspection.result.sampleCheck.expected")}</th>
                        <th className="py-1 text-left">{t("inspection.result.sampleCheck.actual")}</th>
                        <th className="py-1 text-left">{t("inspection.result.sampleCheck.judge")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.items.map((item) => (
                        <tr key={`${row.checkNo}-${item.seqNo}`} className="border-t border-border/60">
                          <td className="py-1 font-mono">{item.sampleCode}</td>
                          <td className="py-1"><ComCodeBadge groupCode="LIMIT_SAMPLE_TYPE" code={item.sampleType} /></td>
                          <td className="py-1">{item.expectedResult}</td>
                          <td className="py-1">{item.actualResult}</td>
                          <td className={`py-1 font-semibold ${item.result === "OK" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {item.result}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
