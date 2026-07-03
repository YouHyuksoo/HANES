"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  Barcode,
  Boxes,
  CalendarDays,
  ChevronLeft,
  Factory,
  Layers,
  Package,
  ScanLine,
  Search,
  Tag,
  Truck,
  User,
  Wrench,
  X,
  type LucideProps,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { TraceSearchInput, TraceSearchMode } from "../types";

interface Props {
  isOpen: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: TraceSearchInput) => void;
}

interface ModeCard {
  mode: TraceSearchMode;
  Icon: ComponentType<LucideProps>;
  label: string;
  description: string;
}

interface SingleInput {
  value: string;
}

interface EquipmentInput {
  equipCode: string;
  dateFrom: string;
  dateTo: string;
}

const MODE_CARDS: ModeCard[] = [
  { mode: "product", Icon: Barcode, label: "제품 바코드", description: "제품 1건의 제조이력과 투입 자재를 역추적" },
  { mode: "material", Icon: Tag, label: "자재 UID", description: "자재 UID가 투입된 대상 제품을 정추적" },
  { mode: "supplierLot", Icon: Layers, label: "원자재 업체 LOT", description: "원자재 업체 LOT(송장번호)이 투입된 제품을 역추적" },
  { mode: "box", Icon: Package, label: "박스번호", description: "박스에 포함된 제품과 포장 이력 조회" },
  { mode: "pallet", Icon: Boxes, label: "팔레트번호", description: "팔레트에 적재된 박스와 제품 조회" },
  { mode: "shipOrder", Icon: Truck, label: "출하지시번호", description: "출하 대상 제품과 포장 단위 조회" },
  { mode: "equipment", Icon: Wrench, label: "설비 + 기간", description: "설비에서 생산 또는 검사된 제품 조회" },
  { mode: "operator", Icon: User, label: "작업자 + 기간", description: "작업자가 기간 내 생산실적을 남긴 제품 조회" },
  { mode: "workOrder", Icon: Factory, label: "작업지시번호", description: "작업지시 기준 생산 제품과 반제품 조회" },
  { mode: "sg", Icon: ScanLine, label: "SFG 바코드", description: "반제품 이력과 해당 SFG를 사용한 제품 조회" },
];

const SINGLE_PLACEHOLDER: Record<Exclude<TraceSearchMode, "equipment" | "operator">, string> = {
  product: "FG 바코드를 스캔하거나 입력",
  material: "MAT_UID를 입력",
  supplierLot: "원자재 업체 LOT(송장번호)를 입력",
  box: "박스번호를 입력",
  pallet: "팔레트번호를 입력",
  shipOrder: "출하지시번호를 입력",
  workOrder: "작업지시번호를 입력",
  sg: "SFG 바코드를 스캔하거나 입력",
};

export default function TraceSearchWizard({ isOpen, loading, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"pick" | "input">("pick");
  const [mode, setMode] = useState<TraceSearchMode | null>(null);
  const [single, setSingle] = useState<SingleInput>({ value: "" });
  const [equipment, setEquipment] = useState<EquipmentInput>(() => defaultEquipmentInput());

  useEffect(() => {
    if (!isOpen) return;
    setStep("pick");
    setMode(null);
    setSingle({ value: "" });
    setEquipment(defaultEquipmentInput());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedCard = MODE_CARDS.find((card) => card.mode === mode);
  const isEquipment = mode === "equipment";
  const isOperator = mode === "operator";
  const needsPeriod = isEquipment || isOperator;
  const canSubmit = needsPeriod
    ? !!equipment.equipCode.trim()
    : !!single.value.trim();

  const pickMode = (nextMode: TraceSearchMode) => {
    setMode(nextMode);
    setStep("input");
  };

  const onBack = () => {
    setMode(null);
    setStep("pick");
  };

  const submit = () => {
    if (!mode || !canSubmit) return;
    if (mode === "equipment") {
      onSubmit({
        mode,
        equipCode: equipment.equipCode.trim(),
        dateFrom: equipment.dateFrom,
        dateTo: equipment.dateTo,
      });
      return;
    }
    if (mode === "operator") {
      onSubmit({
        mode,
        value: equipment.equipCode.trim(),
        dateFrom: equipment.dateFrom,
        dateTo: equipment.dateTo,
      });
      return;
    }
    onSubmit({ mode, value: single.value.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {step === "pick"
                ? t("quality.trace.wizard.pickTitle", "추적 방식 선택")
                : t("quality.trace.wizard.inputTitle", "{{label}} 조회 조건", { label: selectedCard?.label ?? "" })}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">
              {step === "pick"
                ? t("quality.trace.wizard.pickHint", "현재 가진 번호나 조건을 기준으로 시작합니다.")
                : selectedCard?.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close", "닫기")}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5">
          {step === "pick" && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {MODE_CARDS.map(({ mode: cardMode, Icon, label, description }) => (
                <button
                  type="button"
                  key={cardMode}
                  onClick={() => pickMode(cardMode)}
                  className="group flex min-h-[104px] flex-col items-start gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 p-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-950/40"
                >
                  <Icon className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-blue-300" strokeWidth={1.75} />
                  <span className="text-sm font-semibold text-zinc-100">{label}</span>
                  <span className="text-xs leading-5 text-zinc-400">{description}</span>
                </button>
              ))}
            </div>
          )}

          {step === "input" && mode && (
            <div className="space-y-4">
              {needsPeriod ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    label={
                      isOperator
                        ? t("quality.trace.wizard.workerCode", "작업자코드")
                        : t("quality.trace.wizard.equipCode", "설비코드")
                    }
                    value={equipment.equipCode}
                    onChange={(event) => setEquipment((prev) => ({ ...prev, equipCode: event.target.value }))}
                    onKeyDown={(event) => event.key === "Enter" && submit()}
                    leftIcon={isOperator ? <User className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                    fullWidth
                    autoFocus
                  />
                  <Input
                    type="date"
                    label={t("quality.trace.wizard.dateFrom", "시작일")}
                    value={equipment.dateFrom}
                    onChange={(event) => setEquipment((prev) => ({ ...prev, dateFrom: event.target.value }))}
                    leftIcon={<CalendarDays className="h-4 w-4" />}
                    fullWidth
                  />
                  <Input
                    type="date"
                    label={t("quality.trace.wizard.dateTo", "종료일")}
                    value={equipment.dateTo}
                    onChange={(event) => setEquipment((prev) => ({ ...prev, dateTo: event.target.value }))}
                    leftIcon={<CalendarDays className="h-4 w-4" />}
                    fullWidth
                  />
                </div>
              ) : (
                <Input
                  label={selectedCard?.label}
                  value={single.value}
                  placeholder={SINGLE_PLACEHOLDER[mode]}
                  onChange={(event) => setSingle({ value: event.target.value })}
                  onKeyDown={(event) => event.key === "Enter" && submit()}
                  leftIcon={<Search className="h-4 w-4" />}
                  fullWidth
                  autoFocus
                />
              )}

              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                <Button type="button" variant="ghost" onClick={onBack} leftIcon={<ChevronLeft className="h-4 w-4" />}>
                  {t("common.back", "뒤로")}
                </Button>
                <Button type="button" onClick={submit} disabled={!canSubmit || loading} isLoading={loading}>
                  {t("common.search", "조회")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultEquipmentInput(): EquipmentInput {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const today = `${yyyy}-${mm}-${dd}`;
  return { equipCode: "", dateFrom: today, dateTo: today };
}
