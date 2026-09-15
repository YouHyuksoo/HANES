"use client";

/**
 * @file IQC 검사의뢰 LOT 구성. 모집단은 담당자가 담은 입하 수량 합.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { Button, Card, CardContent, Input, Modal } from "@/components/ui";
import { PartSearchModal } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { useIqcRequestLot, type RequestCandidate, type RequestRow } from "@/hooks/material/useIqcRequestLot";

export default function IqcRequestLotPage() {
  const { t } = useTranslation();
  const h = useIqcRequestLot();

  const candidateCols = useMemo<ColumnDef<RequestCandidate>[]>(
    () => [
      { accessorKey: "arrivalNo", header: t("material.iqc.arrivalNoLabel", "입하번호"), size: 140 },
      { accessorKey: "invoiceNo", header: t("material.arrival.invoiceNo", "인보이스"), size: 120 },
      { accessorKey: "qty", header: t("common.qty"), size: 80 },
      { accessorKey: "vendorName", header: t("material.iqc.supplierLabel", "공급업체"), size: 140 },
      {
        id: "act",
        header: t("common.actions"),
        size: 200,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => h.addToBasket(row.original, "SAMPLE")}>
              {t("material.iqcRequestLot.sample", "시료")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => h.addToBasket(row.original, "REPRESENTED")}>
              {t("material.iqcRequestLot.represented", "대표")}
            </Button>
          </div>
        ),
      },
    ],
    [h.addToBasket, t],
  );

  const requestCols = useMemo<ColumnDef<RequestRow>[]>(
    () => [
      { accessorKey: "requestNo", header: t("material.iqcRequestLot.requestNo", "의뢰번호"), size: 150 },
      { accessorKey: "itemCode", header: t("part.code"), size: 110 },
      { accessorKey: "lotQty", header: t("material.iqcRequestLot.lotQty", "모집단수량"), size: 100 },
      { accessorKey: "status", header: t("common.status"), size: 90 },
      {
        id: "act",
        header: t("common.actions"),
        size: 180,
        cell: ({ row }) =>
          row.original.status === "REQUESTED" ? (
            <div className="flex gap-1">
              <Button size="sm" onClick={() => h.setInspectTarget(row.original)}>
                {t("material.iqc.iqcInspect", "IQC 검사")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void h.cancelRequest(row.original.requestNo)}>
                {t("common.cancel")}
              </Button>
            </div>
          ) : null,
      },
    ],
    [h.setInspectTarget, h.cancelRequest, t],
  );

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden p-6 gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("material.iqcRequestLot.title", "IQC 검사의뢰 LOT")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.iqcRequestLot.desc", "품목 하나. 담당자가 입하를 골라 담으면 그 수량 합이 모집단입니다.")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void h.refresh()}>
          <RefreshCw className={`w-4 h-4 mr-1 ${h.loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
        </Button>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <div className="w-56">
          <Input
            label={t("part.code")}
            value={h.itemCode}
            onChange={(e) => h.setItemCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void h.refresh(); }}
            leftIcon={<Search className="w-4 h-4" />}
            fullWidth
          />
        </div>
        <Button variant="outline" onClick={() => h.setPartOpen(true)}>{t("common.search")}</Button>
        <Button onClick={() => void h.refresh()}>{t("material.iqcRequestLot.load", "후보 조회")}</Button>
        <div className="w-48">
          <Input
            label={t("material.iqcRequestLot.invoiceFilter", "인보이스 필터")}
            value={h.invoiceFilter}
            onChange={(e) => h.setInvoiceFilter(e.target.value)}
            placeholder={t("material.iqcRequestLot.invoiceHint", "고르기 쉽게만")}
            fullWidth
          />
        </div>
        {h.itemName ? <span className="text-sm text-text-muted pb-2">{h.itemName}</span> : null}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        <Card className="min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">
                {t("material.iqcRequestLot.candidates", "미의뢰 입하")} ({h.candidates.length}/{h.candidateTotal})
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => h.addVisible("SAMPLE")}>
                  {t("material.iqcRequestLot.addVisibleSample", "보이는 행 시료로")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => h.addVisible("REPRESENTED")}>
                  {t("material.iqcRequestLot.addVisibleRep", "보이는 행 대표로")}
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <DataGrid
                data={h.candidates}
                columns={candidateCols}
                isLoading={h.loading}
                getRowId={(row) => row.arrivalNo}
                emptyMessage={t("material.iqcRequestLot.noCandidates", "품목을 조회한 뒤 입하를 고르세요.")}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-3 flex flex-col min-h-0 gap-2">
            <div className="font-semibold">
              {t("material.iqcRequestLot.basket", "이번 의뢰 구성")} · {t("material.iqcRequestLot.lotQty", "모집단수량")} {h.lotQty.toLocaleString()}
            </div>
            {h.aql ? (
              <p className="text-sm text-text-muted">
                AQL {h.aql.inspectionLevel}/{h.aql.inspectionMode} · {t("material.iqcRequestLot.aqlSample", "권고 시료수")} {h.aql.sampleQty ?? "-"}
              </p>
            ) : null}
            <ul className="flex-1 min-h-0 overflow-auto text-sm space-y-1">
              {h.basket.map((row) => (
                <li key={row.arrivalNo} className="flex justify-between border-b border-border py-1 gap-2">
                  <span>
                    {row.arrivalNo} / {row.qty.toLocaleString()} / {row.invoiceNo ?? "-"} /{" "}
                    {row.lineRole === "SAMPLE"
                      ? t("material.iqcRequestLot.sample", "시료")
                      : t("material.iqcRequestLot.represented", "대표")}
                  </span>
                  <button className="text-text-muted shrink-0" onClick={() => h.setBasket((p) => p.filter((x) => x.arrivalNo !== row.arrivalNo))}>
                    {t("common.delete")}
                  </button>
                </li>
              ))}
            </ul>
            <Input
              label={t("material.iqcRequestLot.sampleQty", "시료수량")}
              value={h.sampleQty}
              onChange={(e) => h.setSampleQty(e.target.value)}
            />
            <Button onClick={() => void h.confirmRequest()}>{t("material.iqcRequestLot.confirm", "의뢰 확정")}</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="h-56 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-3 min-h-0">
          <DataGrid data={h.requests} columns={requestCols} isLoading={h.loading} getRowId={(row) => row.requestNo} />
        </CardContent>
      </Card>

      <PartSearchModal
        isOpen={h.partOpen}
        onClose={() => h.setPartOpen(false)}
        onSelect={(part) => {
          h.setItemCode(part.itemCode);
          h.setItemName(part.itemName);
          h.setPartOpen(false);
        }}
      />

      <Modal
        isOpen={!!h.inspectTarget}
        onClose={() => h.setInspectTarget(null)}
        title={t("material.iqcRequestLot.inspectTitle", "의뢰 LOT 일괄 판정")}
      >
        {h.inspectTarget && (
          <div className="space-y-3">
            <p>
              {h.inspectTarget.requestNo} / {h.inspectTarget.itemCode} / {t("material.iqcRequestLot.lotQty", "모집단수량")}{" "}
              {h.inspectTarget.lotQty.toLocaleString()}
            </p>
            <ul className="text-sm max-h-40 overflow-auto">
              {(h.inspectTarget.lines ?? []).map((line) => (
                <li key={line.arrivalNo}>
                  {line.arrivalNo} {line.qty.toLocaleString()} {line.lineRole}
                </li>
              ))}
            </ul>
            <Input label={t("material.iqc.inspectorLabel", "검사자")} value={h.inspector} onChange={(e) => h.setInspector(e.target.value)} fullWidth />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => void h.inspect("FAIL")}>FAIL</Button>
              <Button onClick={() => void h.inspect("PASS")}>PASS</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
