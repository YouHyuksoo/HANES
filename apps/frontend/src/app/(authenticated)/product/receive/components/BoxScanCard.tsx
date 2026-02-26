"use client";

/**
 * @file components/BoxScanCard.tsx
 * @description 박스 스캔 입고 카드 - 박스번호를 스캔/입력하여 제품 입고를 처리
 *
 * 초보자 가이드:
 * 1. 박스번호를 입력하고 조회 버튼 클릭
 * 2. CLOSED 상태 박스만 입고 가능
 * 3. 품목정보/수량이 자동 표시되며, 창고 선택 후 입고확정
 * 4. 입고 성공 시 onSuccess 콜백으로 부모에게 알림
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Package, Search, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface BoxData {
  id: string;
  boxNo: string;
  itemCode: string;
  qty: number;
  status: string;
  part?: {
    itemCode: string;
    itemName: string;
    itemType: string;
    unit: string;
  } | null;
}

interface BoxScanCardProps {
  onSuccess: () => void;
}

export default function BoxScanCard({ onSuccess }: BoxScanCardProps) {
  const { t } = useTranslation();

  const [boxNo, setBoxNo] = useState("");
  const [scannedBox, setScannedBox] = useState<BoxData | null>(null);
  const [boxError, setBoxError] = useState("");
  const [boxLoading, setBoxLoading] = useState(false);
  const [boxWarehouseId, setBoxWarehouseId] = useState("");
  const [boxSaving, setBoxSaving] = useState(false);

  const partType = scannedBox?.part?.itemType ?? "WIP";
  const { options: boxWhOptions } = useWarehouseOptions(partType);

  /** 박스번호로 조회 */
  const handleBoxLookup = useCallback(async () => {
    if (!boxNo.trim()) return;
    setBoxLoading(true);
    setBoxError("");
    setScannedBox(null);
    try {
      const res = await api.get(`/shipping/boxes/box-no/${encodeURIComponent(boxNo.trim())}`);
      const box = res.data?.data as BoxData;
      if (box.status === "SHIPPED") {
        setBoxError(t("productMgmt.receive.boxScan.alreadyReceived"));
      } else if (box.status !== "CLOSED") {
        setBoxError(t("productMgmt.receive.boxScan.notClosed"));
      } else {
        setScannedBox(box);
      }
    } catch {
      setBoxError(t("common.error"));
    } finally {
      setBoxLoading(false);
    }
  }, [boxNo, t]);

  /** 박스 입고 확정 */
  const handleBoxReceive = useCallback(async () => {
    if (!scannedBox || !boxWarehouseId) return;
    setBoxSaving(true);
    try {
      const pt = scannedBox.part?.itemType ?? "WIP";
      const endpoint = pt === "FG" ? "/inventory/fg/receive" : "/inventory/wip/receive";
      await api.post(endpoint, {
        itemCode: scannedBox.itemCode,
        warehouseCode: boxWarehouseId,
        qty: scannedBox.qty,
        itemType: pt,
        transType: pt === "FG" ? "FG_IN" : "WIP_IN",
        refType: "BOX",
        refId: scannedBox.id,
      });
      setBoxNo("");
      setScannedBox(null);
      setBoxWarehouseId("");
      setBoxError("");
      onSuccess();
    } catch {
      setBoxError(t("common.error"));
    } finally {
      setBoxSaving(false);
    }
  }, [scannedBox, boxWarehouseId, onSuccess, t]);

  /** Enter 키로 조회 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleBoxLookup();
    },
    [handleBoxLookup],
  );

  return (
    <Card>
      <CardContent>
        <h3 className="text-base font-semibold text-text flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-primary" />
          {t("productMgmt.receive.boxScan.title")}
        </h3>

        {/* 스캔 입력 */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              placeholder={t("productMgmt.receive.boxScan.placeholder")}
              value={boxNo}
              onChange={(e) => setBoxNo(e.target.value)}
              onKeyDown={handleKeyDown}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
          <Button onClick={handleBoxLookup} disabled={boxLoading || !boxNo.trim()}>
            {t("productMgmt.receive.boxScan.lookup")}
          </Button>
        </div>

        {/* 에러 */}
        {boxError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            {boxError}
          </div>
        )}

        {/* 스캔 결과 */}
        {scannedBox && (
          <div className="mt-4 p-4 rounded-lg bg-muted dark:bg-slate-800 space-y-3">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-text-muted">{t("common.partCode")}</span>
                <p className="font-mono font-medium text-text">{scannedBox.part?.itemCode ?? "-"}</p>
              </div>
              <div>
                <span className="text-text-muted">{t("common.partName")}</span>
                <p className="font-medium text-text">{scannedBox.part?.itemName ?? "-"}</p>
              </div>
              <div>
                <span className="text-text-muted">{t("common.type")}</span>
                <p className="font-medium text-text">{scannedBox.part?.itemType ?? "-"}</p>
              </div>
              <div>
                <span className="text-text-muted">{t("productMgmt.receive.boxScan.boxQty")}</span>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {scannedBox.qty.toLocaleString()} {scannedBox.part?.unit ?? ""}
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="w-64">
                <Select
                  label={t("productMgmt.receive.modal.warehouseId")}
                  options={boxWhOptions}
                  value={boxWarehouseId}
                  onChange={setBoxWarehouseId}
                />
              </div>
              <Button onClick={handleBoxReceive} disabled={boxSaving || !boxWarehouseId}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {boxSaving ? t("common.saving") : t("productMgmt.receive.boxScan.confirm")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
