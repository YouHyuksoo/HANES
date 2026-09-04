"use client";

/**
 * @file src/app/(authenticated)/material/shelf-life-reinspect/page.tsx
 * @description 유수명자재 재검사 - 재검사 대기 LOT을 골라 검사항목별로 검사하는 처리성 화면
 *
 * 조회 원칙(조건 없는 전량 조회 금지):
 * - 기본 조건 = 재검사 대기: 잔량이 있는 만료됨 + 만료임박 LOT (서버 기본값, expiryStatus 생략)
 *   합격이면 만료일이 연장되고 불합격이면 폐기(DISCARDED)되어 목록에서 자연히 빠진다.
 * - 상태/검색어는 서버 파라미터로 보내고 page/limit 으로 잘라 받는다 (limit 5000 전량 호출 금지)
 * - URL ?matUid= 딥링크는 목록과 별개로 해당 LOT 1건만 조회해 모달을 연다
 */
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FlaskConical, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import ReinspectModal, { type ReinspectTarget } from "./components/ReinspectModal";
import { createShelfLifeReinspectGridColumns, type ShelfLifeItem } from "./shelfLifeReinspectColumns";

/** 서버 페이지 크기 */
const PAGE_SIZE = 200;

function ShelfLifeReinspectContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialMatUid = searchParams.get("matUid") ?? "";

  // 재검사 대상 목록
  const [targets, setTargets] = useState<ShelfLifeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  // ""=재검사 대기 전체(만료+임박) — 서버 기본 조건과 동일
  const [expiryFilter, setExpiryFilter] = useState("");
  const [page, setPage] = useState(1);

  // 검사 모달
  const [modalTarget, setModalTarget] = useState<ReinspectTarget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => { setPage(1); }, [searchText, expiryFilter]);

  const fetchTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText.trim()) params.search = searchText.trim();
      if (expiryFilter) params.expiryStatus = expiryFilter;
      const res = await api.get("/material/shelf-life", { params });
      setTargets(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setTargets([]);
      setTotal(0);
    } finally {
      setTargetsLoading(false);
    }
  }, [page, searchText, expiryFilter]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const openModal = useCallback((item: ShelfLifeItem) => {
    setModalTarget({
      matUid: item.matUid,
      itemCode: item.itemCode,
      itemName: item.itemName,
      unit: item.unit,
      currentQty: item.currentQty,
      expireDate: item.expireDate,
      daysUntilExpiry: item.daysUntilExpiry,
    });
    setIsModalOpen(true);
  }, []);

  // URL ?matUid= 지정 시 해당 LOT만 서버에서 1회 조회해 자동 오픈한다.
  // 목록 페이지에 없어도 열리도록 목록과 분리했고, 모달을 닫아도 다시 열리지 않도록 1회만 실행한다.
  const autoOpenedMatUid = useRef<string | null>(null);
  useEffect(() => {
    if (!initialMatUid || autoOpenedMatUid.current === initialMatUid) return;
    autoOpenedMatUid.current = initialMatUid;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/material/shelf-life", { params: { search: initialMatUid, limit: "5" } });
        const rows: ShelfLifeItem[] = res.data?.data ?? [];
        const found = rows.find((row) => row.matUid === initialMatUid);
        if (found && !cancelled) openModal(found);
      } catch {
        // 대상이 재검사 대기 상태가 아니면(연장·폐기 등) 조용히 무시한다
      }
    })();
    return () => { cancelled = true; };
  }, [initialMatUid, openModal]);

  const handleSubmitted = useCallback(() => {
    fetchTargets();
  }, [fetchTargets]);

  const expiryOptions = useMemo(() => [
    { value: "", label: `${t("material.shelfLife.nearExpiry")} + ${t("material.shelfLife.expired")}` },
    { value: "EXPIRED", label: t("material.shelfLife.expired") },
    { value: "NEAR_EXPIRY", label: t("material.shelfLife.nearExpiry") },
  ], [t]);

  const targetColumns = useMemo(() => createShelfLifeReinspectGridColumns({ t, onInspect: openModal }), [t, openModal]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text">
            <FlaskConical className="h-7 w-7 text-primary" />
            {t("material.shelfLife.reinspectTitle")}
          </h1>
          <p className="mt-1 text-text-muted">
            {t("material.shelfLife.reinspectSubtitle", "유수명자재 재검사 대상을 선택해 검사항목별로 검사합니다. 이력은 유수명자재 검사이력 화면에서 조회합니다.")}{" "}
            <span className="text-xs">({t("material.shelfLife.reinspectScopeHint", "기본: 재검사 대기 = 잔량이 있는 만료·만료임박 LOT")})</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          <Button variant="secondary" size="sm" onClick={fetchTargets}>
            <RefreshCw className={`mr-1 h-4 w-4 ${targetsLoading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 재검사 대상 목록 */}
      <Card className="min-h-0 flex-1 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            sqlQuery={`SELECT *\nFROM MAT_LOTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND EXPIRE_DATE IS NOT NULL\n  AND CURRENT_QTY > 0\n  AND STATUS <> 'DISCARDED'\n  AND EXPIRE_DATE <= TRUNC(SYSDATE) + 10\nORDER BY EXPIRE_DATE ASC`}
            data={targets}
            columns={targetColumns}
            isLoading={targetsLoading}
            enableColumnFilter
            enableExport
            exportFileName={t("material.shelfLife.reinspectTarget", "재검사 대상")}
            toolbarLeft={
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="min-w-0 flex-1">
                  <Input placeholder={t("material.shelfLife.searchPlaceholder")}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={expiryOptions} value={expiryFilter} onChange={setExpiryFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <ReinspectModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setModalTarget(null); }}
        target={modalTarget}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}

export default function ShelfLifeReinspectPage() {
  return (
    <Suspense>
      <ShelfLifeReinspectContent />
    </Suspense>
  );
}
