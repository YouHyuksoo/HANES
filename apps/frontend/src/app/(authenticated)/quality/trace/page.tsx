"use client";

/**
 * @file src/app/(authenticated)/quality/trace/page.tsx
 * @description 추적성조회 페이지 — 시리얼 번호로 제품 이력 전체 조회 (섹션형)
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, History } from "lucide-react";
import { Card, CardHeader, CardContent, Button, Input } from "@/components/ui";
import api from "@/services/api";
import type { ProductTraceabilityDto } from "./types";
import MaterialSection from "./components/MaterialSection";
import SemiProductSection from "./components/SemiProductSection";
import EquipInspectionSection from "./components/EquipInspectionSection";
import EquipConsumableSection from "./components/EquipConsumableSection";
import DefectRepairSection from "./components/DefectRepairSection";

export default function TracePage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [data, setData] = useState<ProductTraceabilityDto | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchValue.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get("/quality/trace", {
        params: { serial: searchValue.trim() },
      });
      setData(res.data?.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [searchValue]);

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6 gap-4 animate-fade-in">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <History className="w-7 h-7 text-primary" />
          {t("quality.trace.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("quality.trace.description")}</p>
      </div>

      {/* 검색 바 */}
      <Card>
        <CardContent>
          <div className="flex gap-4">
            <Input
              className="flex-1"
              placeholder={t("quality.trace.searchPlaceholder")}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="w-4 h-4 mr-1" />
              {t("common.search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 검색 결과 없음 */}
      {searched && !data && !loading && (
        <Card>
          <CardContent>
            <div className="text-center py-12 text-text-muted">
              {t("quality.trace.noResults")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과 섹션 */}
      {data && (
        <>
          {/* 상단: ① 기본정보 + ④ 포장·출하 (2열) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader title={t("quality.trace.productInfo")} />
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                  <Field label={t("quality.trace.serialNo")} value={data.product.serialNo} mono />
                  <Field label={t("quality.trace.partNo")} value={data.product.itemNo} />
                  <Field label={t("quality.trace.partName")} value={data.product.itemName} />
                  <Field label={t("quality.trace.workOrderNo")} value={data.product.orderNo ?? "-"} mono />
                  <Field label={t("quality.trace.statusCol")} value={data.product.status} />
                  <Field label={t("quality.trace.productionDate")} value={fmt(data.product.productionDate)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title={t("quality.trace.packaging")} />
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                  <Field label={t("quality.trace.boxNo")} value={data.packaging.boxNo ?? "-"} mono />
                  <Field label={t("quality.trace.boxPackedAt")} value={fmt(data.packaging.boxPackedAt)} />
                  <Field label={t("quality.trace.palletNo")} value={data.packaging.palletNo ?? "-"} mono />
                  <Field label={t("quality.trace.palletPackedAt")} value={fmt(data.packaging.palletPackedAt)} />
                  <Field label={t("quality.trace.shippedAt")} value={fmt(data.packaging.shippedAt)} />
                  <Field label={t("quality.trace.shipOrderNo", "출하지시번호")} value={data.packaging.shipOrderNo ?? "-"} mono />
                  <Field label={t("quality.trace.customerPoNo", "고객PO번호")} value={data.packaging.customerPoNo ?? "-"} mono />
                  <Field label={t("quality.trace.customerName", "고객명")} value={data.packaging.customerName ?? "-"} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ② 공정 생산이력 + ③ 검사 기록 (2열) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader title={t("quality.trace.processTimeline")} />
              <CardContent>
                <ul className="divide-y divide-border">
                  {data.processHistory.map((s, i) => (
                    <li
                      key={`${i}-${s.timestamp}-${s.process}`}
                      className="flex items-center gap-3 text-sm py-1.5"
                    >
                      <span className="font-mono text-xs text-text-muted shrink-0">
                        {s.timestamp.slice(5, 16).replace("T", " ")}
                      </span>
                      <span className="font-medium text-text">{s.processName}</span>
                      <span className="text-xs text-text-muted truncate">
                        {s.equipmentName} / {s.operator}
                      </span>
                      <span className="ml-auto shrink-0">{badge(s.result)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title={t("quality.trace.inspections")} />
              <CardContent>
                {data.inspections.length === 0 ? (
                  <div className="text-sm text-text-muted py-1.5">
                    {t("quality.trace.noInspections", "검사 기록 없음")}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.inspections.map((ir, i) => (
                      <li
                        key={`${i}-${ir.inspectAt}-${ir.inspectType}`}
                        className="flex items-center gap-3 text-sm py-1.5"
                      >
                        <span className="font-mono text-xs text-text-muted shrink-0">
                          {ir.inspectAt.slice(5, 16).replace("T", " ")}
                        </span>
                        <span className="font-medium text-text">{ir.inspectType}</span>
                        <span className="text-xs text-text-muted truncate">{ir.inspectorId}</span>
                        <span className="ml-auto shrink-0">{badge(ir.result)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ⑤ 투입 자재 (전체폭 — PO/IQC 중첩 정보량 많음) */}
          <Card>
            <CardHeader title={t("quality.trace.materials")} />
            <CardContent>
              <MaterialSection materials={data.materials} />
            </CardContent>
          </Card>

          {/* ⑥ 투입 반제품 (전체폭) */}
          <Card>
            <CardHeader title={t("quality.trace.semiProducts")} />
            <CardContent>
              <SemiProductSection semiProducts={data.semiProducts} />
            </CardContent>
          </Card>

          {/* ⑦ 설비점검 + ⑧ 소모품 (2열) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader title={t("quality.trace.equipInspections", "설비점검 내역")} />
              <CardContent>
                <EquipInspectionSection inspections={data.equipInspections} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title={t("quality.trace.equipConsumables", "설비 장착 소모품")} />
              <CardContent>
                <EquipConsumableSection consumables={data.equipConsumables} />
              </CardContent>
            </Card>
          </div>

          {/* ⑨ 불량·수리 (전체폭) */}
          <Card>
            <CardHeader title={t("quality.trace.defectRepair", "불량·수리 이력")} />
            <CardContent>
              <DefectRepairSection defects={data.defects} repairs={data.repairs} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className={`text-sm truncate ${mono ? "font-mono text-text" : "text-text"}`}>{value}</div>
    </div>
  );
}

function fmt(s: string | null): string {
  return s ? s.slice(0, 19).replace("T", " ") : "-";
}

function badge(r: "PASS" | "FAIL" | "WORK") {
  const cls =
    r === "PASS"
      ? "text-green-600 border-green-600"
      : r === "FAIL"
        ? "text-red-600 border-red-600"
        : "text-blue-600 border-blue-600";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}
    >
      {r}
    </span>
  );
}
