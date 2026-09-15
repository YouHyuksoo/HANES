"use client";

/**
 * @file inspection/result/components/SampleCheckModal.tsx
 * @description 양불마스터(한도견본) 대조 모달 — 견본 바코드 스캔 후 검사기 결과 입력
 *
 * 초보자 가이드:
 * 1. 후보는 품목·검사유형 기준으로 서버가 내려준다(INSPECT_AIDS).
 * 2. 견본 바코드(AID_CODE)를 스캔한 행만 합격/불합격 버튼이 열린다.
 * 3. OK/NG 판정은 서버가 기대값(양품=합격, 불량=불합격)과 비교해 산출한다. 화면은 판정하지 않는다.
 * 4. 필수 견본이 만료면 저장을 막고 기준정보 갱신을 안내한다.
 * 5. alert/confirm 대신 공용 Modal과 토스트를 쓴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Modal, Button, ComCodeBadge } from "@/components/ui";
import { BarcodeScanInput, InspectItemImage } from "@/components/shared";
import api from "@/services/api";

export interface SampleCheckCandidate {
  aidCode: string;
  aidName: string;
  aidType: string;
  expectedResult: "PASS" | "FAIL";
  requiredYn: string;
  sortOrder: number;
  imageUrl: string | null;
  defectCode: string | null;
  location: string | null;
  validTo: string | null;
  status: string;
  expired: boolean;
}

interface SampleCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  orderNo: string;
  itemCode: string;
  equipCode: string;
  inspectType: "CONTINUITY" | "TERMINAL";
  workerId?: string | null;
}

export default function SampleCheckModal({
  isOpen, onClose, onDone, orderNo, itemCode, equipCode, inspectType, workerId,
}: SampleCheckModalProps) {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<SampleCheckCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanValue, setScanValue] = useState("");
  /** 스캔된 견본만 결과 입력을 허용한다 (실물 확인 증적) */
  const [scannedCodes, setScannedCodes] = useState<Record<string, string>>({});
  const [actualResults, setActualResults] = useState<Record<string, "PASS" | "FAIL">>({});
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/continuity-inspect/sample-check/candidates", {
        params: { itemCode, inspectType },
      });
      setCandidates(res.data?.data ?? []);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [itemCode, inspectType]);

  useEffect(() => {
    if (!isOpen) return;
    setScanValue("");
    setScannedCodes({});
    setActualResults({});
    setActiveCode(null);
    void loadCandidates();
  }, [isOpen, loadCandidates]);

  /** 견본 바코드 스캔 — AID_CODE 를 그대로 바코드로 쓴다(대소문자·공백 정규화). */
  const handleScan = useCallback((raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    const found = candidates.find((c) => c.aidCode.trim().toUpperCase() === code);
    setScanValue("");
    if (!found) {
      toast.error(t("inspection.result.sampleCheck.unknownCode", { code }));
      return;
    }
    setScannedCodes((prev) => ({ ...prev, [found.aidCode]: new Date().toISOString() }));
    setActiveCode(found.aidCode);
    scanRef.current?.focus();
  }, [candidates, t]);

  const requiredCandidates = useMemo(
    () => candidates.filter((c) => c.requiredYn === "Y"),
    [candidates],
  );
  const expiredRequired = useMemo(
    () => requiredCandidates.filter((c) => c.expired),
    [requiredCandidates],
  );
  const allRequiredAnswered = requiredCandidates.every((c) => actualResults[c.aidCode]);
  const canSave = !saving
    && candidates.length > 0
    && expiredRequired.length === 0
    && allRequiredAnswered;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const items = candidates
        .filter((c) => actualResults[c.aidCode])
        .map((c) => ({
          aidCode: c.aidCode,
          actualResult: actualResults[c.aidCode],
          scannedAt: scannedCodes[c.aidCode] ?? null,
        }));
      const res = await api.post("/quality/continuity-inspect/sample-check", {
        orderNo, inspectType, equipCode, itemCode, items,
        ...(workerId ? { workerId } : {}),
      });
      const overall = res.data?.data?.overallResult;
      if (overall === "PASS") {
        toast.success(t("inspection.result.sampleCheck.saved"));
        onDone();
        onClose();
        return;
      }
      // NG도 이력에 남는다. 모달은 열어두고 재대조를 받는다.
      toast.error(t("inspection.result.sampleCheck.savedNg"));
      setScannedCodes({});
      setActualResults({});
      setActiveCode(null);
      onDone();
    } catch {
      // 서버 오류 메시지는 공용 에러 모달이 표시한다.
    } finally {
      setSaving(false);
    }
  }, [candidates, actualResults, scannedCodes, orderNo, inspectType, equipCode, itemCode, workerId, onDone, onClose, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={t("inspection.result.sampleCheck.title")}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-text-muted">{t("inspection.result.sampleCheck.subtitle")}</p>

        <BarcodeScanInput
          ref={scanRef}
          value={scanValue}
          onChange={setScanValue}
          onScan={handleScan}
          placeholder={t("inspection.result.sampleCheck.scanPlaceholder")}
          maintainFocus
          refocusAfterScan
          fullWidth
        />

        {expiredRequired.length > 0 && (
          <div className="flex items-start gap-2 rounded border border-red-500 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{t("inspection.result.sampleCheck.expiredBlocked")}</p>
              <p className="mt-0.5 font-mono">
                {expiredRequired.map((c) => `${c.aidCode}${c.validTo ? ` (${c.validTo})` : ""}`).join(", ")}
              </p>
            </div>
          </div>
        )}

        {!loading && candidates.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            {t("inspection.result.sampleCheck.noCandidates")}
          </p>
        )}

        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {candidates.map((candidate) => {
            const scanned = Boolean(scannedCodes[candidate.aidCode]);
            const actual = actualResults[candidate.aidCode];
            return (
              <div
                key={candidate.aidCode}
                className={[
                  "flex items-center gap-3 rounded border px-3 py-2",
                  activeCode === candidate.aidCode ? "border-primary" : "border-border",
                ].join(" ")}
              >
                <InspectItemImage imageUrl={candidate.imageUrl} alt={candidate.aidName} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{candidate.aidCode}</span>
                    <ComCodeBadge groupCode="INSPECT_AID_TYPE" code={candidate.aidType} />
                    {candidate.requiredYn === "Y" && (
                      <span className="rounded border border-primary px-1 py-0.5 text-[10px] font-semibold text-primary">
                        {t("inspection.result.sampleCheck.required")}
                      </span>
                    )}
                    {candidate.expired && (
                      <span className="rounded border border-red-600 px-1 py-0.5 text-[10px] font-semibold text-red-600 dark:border-red-400 dark:text-red-400">
                        {t("inspection.result.sampleCheck.expired")}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className="truncate text-text">{candidate.aidName}</span>
                    <span className="shrink-0 text-text-muted">
                      {candidate.expectedResult === "PASS"
                        ? t("inspection.result.sampleCheck.expectedPass")
                        : t("inspection.result.sampleCheck.expectedFail")}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant={actual === "PASS" ? "primary" : "secondary"}
                    disabled={!scanned || candidate.expired}
                    title={!scanned ? t("inspection.result.sampleCheck.notScanned") : undefined}
                    onClick={() => setActualResults((prev) => ({ ...prev, [candidate.aidCode]: "PASS" }))}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    {t("inspection.result.sampleCheck.actualPass")}
                  </Button>
                  <Button
                    size="sm"
                    variant={actual === "FAIL" ? "danger" : "secondary"}
                    disabled={!scanned || candidate.expired}
                    title={!scanned ? t("inspection.result.sampleCheck.notScanned") : undefined}
                    onClick={() => setActualResults((prev) => ({ ...prev, [candidate.aidCode]: "FAIL" }))}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    {t("inspection.result.sampleCheck.actualFail")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? t("common.saving", "저장 중") : t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
