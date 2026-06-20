"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, PackagePlus, Printer, RefreshCw, ScanLine, X } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import api from "@/services/api";

interface OrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
  remainingQty: number;
}

interface CandidateBox {
  boxNo: string;
  itemCode: string;
  qty: number;
  oqcStatus?: string | null;
  closeAt?: string | null;
}

interface OrderPallet {
  palletNo: string;
  status: string;
  boxCount: number;
  totalQty: number;
  boxes?: CandidateBox[];
}

interface Fulfillment {
  order: {
    shipOrderNo: string;
    customerName?: string | null;
    shipDate?: string | null;
    dueDate?: string | null;
  };
  lines: OrderLine[];
  candidateBoxes: CandidateBox[];
  pallets: OrderPallet[];
}

interface Props {
  isOpen: boolean;
  shipOrderNo: string | null;
  onClose: () => void;
  onChanged: () => void;
}

const fmt = (value?: number | null) => (value ?? 0).toLocaleString();

export default function OrderFulfillmentModal({ isOpen, shipOrderNo, onClose, onChanged }: Props) {
  const [data, setData] = useState<Fulfillment | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [selectedBoxes, setSelectedBoxes] = useState<Set<string>>(new Set());
  const [selectedPalletNo, setSelectedPalletNo] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [verifiedPallets, setVerifiedPallets] = useState<Set<string>>(new Set());
  const scanRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!shipOrderNo) return;
    setLoading(true);
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(shipOrderNo)}/fulfillment`);
      const next: Fulfillment = res.data?.data;
      setData(next);
      setSelectedPalletNo((current) => {
        if (current && next.pallets.some((pallet) => pallet.palletNo === current && pallet.status === "OPEN")) {
          return current;
        }
        return next.pallets.find((pallet) => pallet.status === "OPEN")?.palletNo ?? null;
      });
      setSelectedBoxes(new Set());
      setVerifiedPallets(new Set());
    } finally {
      setLoading(false);
    }
  }, [shipOrderNo]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const openPallets = useMemo(
    () => data?.pallets.filter((pallet) => pallet.status === "OPEN") ?? [],
    [data],
  );
  const closedPallets = useMemo(
    () => data?.pallets.filter((pallet) => pallet.status === "CLOSED") ?? [],
    [data],
  );

  const selectedBoxList = useMemo(
    () => [...selectedBoxes],
    [selectedBoxes],
  );

  const createPallet = useCallback(async () => {
    if (!shipOrderNo) return;
    setWorking(true);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(shipOrderNo)}/pallets`, {});
      await load();
      onChanged();
    } finally {
      setWorking(false);
    }
  }, [shipOrderNo, load, onChanged]);

  const addBoxes = useCallback(async () => {
    if (!shipOrderNo || !selectedPalletNo || selectedBoxList.length === 0) return;
    setWorking(true);
    try {
      await api.post(
        `/shipping/orders/${encodeURIComponent(shipOrderNo)}/pallets/${encodeURIComponent(selectedPalletNo)}/boxes`,
        { boxIds: selectedBoxList },
      );
      await load();
      onChanged();
    } finally {
      setWorking(false);
    }
  }, [shipOrderNo, selectedPalletNo, selectedBoxList, load, onChanged]);

  const closePallet = useCallback(async (palletNo: string) => {
    if (!shipOrderNo) return;
    setWorking(true);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(shipOrderNo)}/pallets/${encodeURIComponent(palletNo)}/close`);
      await load();
      onChanged();
    } finally {
      setWorking(false);
    }
  }, [shipOrderNo, load, onChanged]);

  const toggleBox = useCallback((boxNo: string) => {
    setSelectedBoxes((prev) => {
      const next = new Set(prev);
      if (next.has(boxNo)) next.delete(boxNo);
      else next.add(boxNo);
      return next;
    });
  }, []);

  const verifyPallet = useCallback(() => {
    const barcode = scanInput.trim();
    if (!barcode) return;
    const exists = closedPallets.some((pallet) => pallet.palletNo === barcode);
    if (exists) {
      setVerifiedPallets((prev) => new Set([...prev, barcode]));
    }
    setScanInput("");
    requestAnimationFrame(() => scanRef.current?.focus());
  }, [scanInput, closedPallets]);

  const shipPallets = useCallback(async () => {
    if (!shipOrderNo || verifiedPallets.size === 0) return;
    setWorking(true);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(shipOrderNo)}/ship-pallets`, {
        palletNos: [...verifiedPallets],
      });
      await load();
      onChanged();
    } finally {
      setWorking(false);
    }
  }, [shipOrderNo, verifiedPallets, load, onChanged]);

  const closeWithRefresh = useCallback(() => {
    onClose();
    onChanged();
  }, [onClose, onChanged]);

  return (
    <Modal isOpen={isOpen} onClose={closeWithRefresh} title="출하작업" size="full">
      <div className="flex h-[78vh] min-h-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-primary">{data?.order.shipOrderNo ?? shipOrderNo}</span>
              {loading && <RefreshCw className="h-4 w-4 animate-spin text-text-muted" />}
            </div>
            <div className="mt-1 text-sm text-text-muted">
              {data?.order.customerName ?? "-"} · 출하예정 {data?.order.shipDate ?? data?.order.dueDate ?? "-"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={createPallet} disabled={working || !shipOrderNo}>
              <PackagePlus className="mr-1 h-4 w-4" /> 팔레트 생성
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.9fr)_minmax(340px,0.7fr)] gap-4">
          <section className="flex min-h-0 flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {data?.lines.map((line) => (
                <div key={line.itemCode} className="rounded border border-border bg-surface-secondary p-3">
                  <div className="truncate text-sm font-semibold text-text">{line.itemName ?? line.itemCode}</div>
                  <div className="mt-1 font-mono text-xs text-text-muted">{line.itemCode}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-right text-xs">
                    <span>지시 {fmt(line.orderQty)}</span>
                    <span>출하 {fmt(line.shippedQty)}</span>
                    <span className="font-bold text-primary">잔량 {fmt(line.remainingQty)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="text-sm font-semibold text-text">가용 박스</div>
                <Button size="sm" onClick={addBoxes} disabled={working || !selectedPalletNo || selectedBoxList.length === 0}>
                  선택 박스 적재
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-secondary text-xs text-text-muted">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left"></th>
                      <th className="px-3 py-2 text-left">박스번호</th>
                      <th className="px-3 py-2 text-left">품목</th>
                      <th className="px-3 py-2 text-right">수량</th>
                      <th className="px-3 py-2 text-left">OQC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.candidateBoxes ?? []).map((box) => (
                      <tr key={box.boxNo} className="border-t border-border">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedBoxes.has(box.boxNo)} onChange={() => toggleBox(box.boxNo)} />
                        </td>
                        <td className="px-3 py-2 font-mono">{box.boxNo}</td>
                        <td className="px-3 py-2">{box.itemCode}</td>
                        <td className="px-3 py-2 text-right">{fmt(box.qty)}</td>
                        <td className="px-3 py-2">{box.oqcStatus ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data?.candidateBoxes?.length && (
                  <div className="p-6 text-center text-sm text-text-muted">적재 가능한 박스가 없습니다.</div>
                )}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <div className="rounded border border-border">
              <div className="border-b border-border px-3 py-2 text-sm font-semibold text-text">팔레트 구성</div>
              <div className="max-h-[32vh] overflow-auto">
                {(data?.pallets ?? []).map((pallet) => (
                  <div key={pallet.palletNo} className="border-b border-border p-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        className={`min-w-0 truncate font-mono text-sm font-semibold ${selectedPalletNo === pallet.palletNo ? "text-primary" : "text-text"}`}
                        onClick={() => pallet.status === "OPEN" && setSelectedPalletNo(pallet.palletNo)}
                      >
                        {pallet.palletNo}
                      </button>
                      <span className="rounded border border-border px-2 py-0.5 text-xs text-text-muted">{pallet.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      박스 {fmt(pallet.boxCount)} · 수량 {fmt(pallet.totalQty)}
                    </div>
                    {pallet.status === "OPEN" && (
                      <Button className="mt-2" variant="secondary" size="sm" onClick={() => closePallet(pallet.palletNo)} disabled={working || pallet.boxCount <= 0}>
                        <Printer className="mr-1 h-4 w-4" /> 팔레트 라벨 발행
                      </Button>
                    )}
                  </div>
                ))}
                {!data?.pallets?.length && (
                  <div className="p-5 text-center text-sm text-text-muted">생성된 팔레트가 없습니다.</div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded border border-border">
              <div className="border-b border-border px-3 py-2 text-sm font-semibold text-text">제품출하 스캔</div>
              <div className="space-y-3 p-3">
                <div className="flex gap-2">
                  <Input
                    ref={scanRef}
                    value={scanInput}
                    onChange={(event) => setScanInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") verifyPallet(); }}
                    placeholder="팔레트 바코드 스캔"
                    leftIcon={<ScanLine className="h-4 w-4" />}
                    fullWidth
                  />
                  <Button variant="secondary" onClick={verifyPallet}>확인</Button>
                </div>
                <div className="rounded bg-surface-secondary p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">스캔</span>
                    <span className="font-mono font-bold text-primary">{verifiedPallets.size} / {closedPallets.length}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[...verifiedPallets].map((palletNo) => (
                      <span key={palletNo} className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs">
                        <CheckCircle className="h-3 w-3 text-green-600" /> {palletNo}
                      </span>
                    ))}
                  </div>
                </div>
                <Button onClick={shipPallets} disabled={working || verifiedPallets.size === 0}>
                  제품출하 확정
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="secondary" onClick={closeWithRefresh}>
            <X className="mr-1 h-4 w-4" /> 닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
