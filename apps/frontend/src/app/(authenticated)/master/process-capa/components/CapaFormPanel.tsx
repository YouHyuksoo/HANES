"use client";

/**
 * @file master/process-capa/components/CapaFormPanel.tsx
 * @description 공정 CAPA 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. editingItem=null -> 신규 등록, 있으면 수정 모드
 * 2. 공정 Select: /master/processes API에서 옵션 로드
 * 3. 품목 검색: PartSearchModal 사용
 * 4. 택트타임 변경 시 UPH 자동계산 (3600/택트타임)
 * 5. 일일CAPA 미리보기: UPH * 8h * multiplier * (효율/100)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import PartSearchModal, {
  type PartItem,
} from "@/components/shared/PartSearchModal";
import api from "@/services/api";

/** 공정 CAPA 아이템 타입 (부모에서 전달) */
interface ProcessCapaItem {
  processCode: string;
  itemCode: string;
  stdTactTime: number;
  stdUph: number;
  workerCnt: number;
  boardCnt: number;
  equipCnt: number;
  setupTime: number;
  balanceEff: number;
  dailyCapa: number;
  useYn: string;
  remark?: string | null;
  process?: { processCode: string; processName: string } | null;
  part?: { itemCode: string; itemName: string } | null;
}

interface CapaFormPanelProps {
  editingItem: ProcessCapaItem | null;
  onClose: () => void;
  onSave: () => void;
}

interface FormState {
  processCode: string;
  itemCode: string;
  itemName: string;
  stdTactTime: number;
  stdUph: number;
  workerCnt: number;
  boardCnt: number;
  equipCnt: number;
  setupTime: number;
  balanceEff: number;
  useYn: string;
  remark: string;
}

const INIT: FormState = {
  processCode: "",
  itemCode: "",
  itemName: "",
  stdTactTime: 0,
  stdUph: 0,
  workerCnt: 1,
  boardCnt: 0,
  equipCnt: 0,
  setupTime: 0,
  balanceEff: 100,
  useYn: "Y",
  remark: "",
};

export default function CapaFormPanel({
  editingItem,
  onClose,
  onSave,
}: CapaFormPanelProps) {
  const { t } = useTranslation();
  const isEdit = !!editingItem;

  const [form, setForm] = useState<FormState>(INIT);
  const [saving, setSaving] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  /* -- 공정 옵션 -- */
  const [processOptions, setProcessOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/master/processes", {
          params: { limit: "5000" },
        });
        const list = res.data?.data ?? [];
        setProcessOptions(
          list.map((p: { processCode: string; processName: string }) => ({
            value: p.processCode,
            label: `${p.processCode} - ${p.processName}`,
          })),
        );
      } catch {
        setProcessOptions([]);
      }
    })();
  }, []);

  /* -- 수정 시 초기값 세팅 -- */
  useEffect(() => {
    if (editingItem) {
      setForm({
        processCode: editingItem.processCode,
        itemCode: editingItem.itemCode,
        itemName: editingItem.part?.itemName ?? "",
        stdTactTime: editingItem.stdTactTime,
        stdUph: editingItem.stdUph,
        workerCnt: editingItem.workerCnt,
        boardCnt: editingItem.boardCnt,
        equipCnt: editingItem.equipCnt,
        setupTime: editingItem.setupTime,
        balanceEff: editingItem.balanceEff,
        useYn: editingItem.useYn,
        remark: editingItem.remark ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editingItem]);

  /* -- 필드 업데이트 -- */
  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        // 택트타임 변경 시 UPH 자동계산
        if (key === "stdTactTime" && typeof value === "number" && value > 0) {
          next.stdUph = Math.round(3600 / value);
        }
        return next;
      });
    },
    [],
  );

  /* -- 일일 CAPA 계산 -- */
  const dailyCapaPreview = useMemo(() => {
    const hours = 8;
    const multiplier =
      form.equipCnt > 0
        ? form.equipCnt
        : form.workerCnt > 0
          ? form.workerCnt
          : 1;
    return Math.floor(
      form.stdUph * hours * multiplier * (form.balanceEff / 100),
    );
  }, [form.stdUph, form.equipCnt, form.workerCnt, form.balanceEff]);

  /* -- 품목 선택 -- */
  const handlePartSelect = useCallback(
    (part: PartItem) => {
      setField("itemCode", part.itemCode);
      setForm((prev) => ({ ...prev, itemName: part.itemName }));
    },
    [setField],
  );

  /* -- 저장 -- */
  const handleSave = useCallback(async () => {
    if (!form.processCode || !form.itemCode) return;
    setSaving(true);
    try {
      const payload = {
        processCode: form.processCode,
        itemCode: form.itemCode,
        stdTactTime: form.stdTactTime,
        stdUph: form.stdUph,
        workerCnt: form.workerCnt,
        boardCnt: form.boardCnt,
        equipCnt: form.equipCnt,
        setupTime: form.setupTime,
        balanceEff: form.balanceEff,
        dailyCapa: dailyCapaPreview,
        useYn: form.useYn,
        remark: form.remark || undefined,
      };
      if (isEdit) {
        await api.put(
          `/master/process-capas/${form.processCode}/${form.itemCode}`,
          payload,
        );
      } else {
        await api.post("/master/process-capas", payload);
      }
      onSave();
    } catch {
      /* api interceptor handles */
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, dailyCapaPreview, onSave]);

  /* -- 사용여부 옵션 -- */
  const useYnOptions = useMemo(
    () => [
      { value: "Y", label: t("common.yes") },
      { value: "N", label: t("common.no") },
    ],
    [t],
  );

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("common.edit") : t("processCapa.addCapa")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !form.processCode || !form.itemCode}
          >
            {saving
              ? t("common.saving")
              : isEdit
                ? t("common.edit")
                : t("common.add")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-4">
        {/* 공정 */}
        <Select
          label={t("processCapa.processCode")}
          options={processOptions}
          value={form.processCode}
          onChange={(v) => setField("processCode", v)}
          disabled={isEdit}
          fullWidth
        />

        {/* 품목 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("processCapa.itemCode")}
          </label>
          <div className="flex gap-2">
            <Input
              value={
                form.itemCode
                  ? `${form.itemCode} - ${form.itemName}`
                  : ""
              }
              readOnly
              fullWidth
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPartSearchOpen(true)}
              disabled={isEdit}
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 택트타임 / UPH */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("processCapa.stdTactTime")}
            type="number"
            value={form.stdTactTime.toString()}
            onChange={(e) =>
              setField("stdTactTime", parseFloat(e.target.value) || 0)
            }
            fullWidth
          />
          <Input
            label={t("processCapa.stdUph")}
            type="number"
            value={form.stdUph.toString()}
            readOnly
            fullWidth
          />
        </div>

        {/* 작업자 / 보드 / 설비 */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label={t("processCapa.workerCnt")}
            type="number"
            value={form.workerCnt.toString()}
            onChange={(e) =>
              setField("workerCnt", parseInt(e.target.value) || 0)
            }
            fullWidth
          />
          <Input
            label={t("processCapa.boardCnt")}
            type="number"
            value={form.boardCnt.toString()}
            onChange={(e) =>
              setField("boardCnt", parseInt(e.target.value) || 0)
            }
            fullWidth
          />
          <Input
            label={t("processCapa.equipCnt")}
            type="number"
            value={form.equipCnt.toString()}
            onChange={(e) =>
              setField("equipCnt", parseInt(e.target.value) || 0)
            }
            fullWidth
          />
        </div>

        {/* 전환시간 / 밸런싱 효율 */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("processCapa.setupTime")}
            type="number"
            value={form.setupTime.toString()}
            onChange={(e) =>
              setField("setupTime", parseFloat(e.target.value) || 0)
            }
            fullWidth
          />
          <Input
            label={t("processCapa.balanceEff")}
            type="number"
            value={form.balanceEff.toString()}
            onChange={(e) =>
              setField("balanceEff", parseFloat(e.target.value) || 0)
            }
            fullWidth
          />
        </div>

        {/* 일일 CAPA (미리보기) */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <label className="block text-xs font-medium text-text mb-1">
            {t("processCapa.dailyCapa")}
          </label>
          <p className="text-lg font-bold text-primary">
            {dailyCapaPreview.toLocaleString()}
          </p>
          <p className="text-[10px] text-text-muted mt-1">
            = UPH({form.stdUph}) x 8h x{" "}
            {form.equipCnt > 0
              ? `${form.equipCnt} equip`
              : `${form.workerCnt || 1} worker`}{" "}
            x {form.balanceEff}%
          </p>
        </div>

        {/* 사용여부 / 비고 */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t("common.active")}
            options={useYnOptions}
            value={form.useYn}
            onChange={(v) => setField("useYn", v)}
            fullWidth
          />
          <Input
            label={t("common.remark")}
            value={form.remark}
            onChange={(e) => setField("remark", e.target.value)}
            fullWidth
          />
        </div>
      </div>

      {/* 품목 검색 모달 */}
      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        onSelect={handlePartSelect}
      />
    </div>
  );
}
