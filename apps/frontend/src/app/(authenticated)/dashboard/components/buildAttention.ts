/**
 * @file src/app/(authenticated)/dashboard/components/buildAttention.ts
 * @description "조치 필요" 큐 생성 — 4개 API 데이터에서 예외 항목만 뽑아 심각도 순으로 정렬한다.
 *
 * 초보자 가이드:
 * 1. 순수 함수. 화면 상태/훅에 의존하지 않아 단독 검증이 가능하다.
 * 2. 심각도: critical(설비 정지·점검 불합격) > high(불량 미처리·기한초과·보류재고·보류지시)
 *            > medium(안전재고 미달·기한임박·수리대기) > low(점검 미실시)
 * 3. 건수 0 인 항목은 큐에 넣지 않는다. 큐가 비면 "정상" 이다.
 */
import type { AttentionDetail, AttentionItem, AttentionSeverity, DashboardData } from "./types";

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function samplesOf(names: Array<string | null | undefined>, max = 3): string[] {
  return names.filter((n): n is string => !!n).slice(0, max);
}

/** 상세 목록에서 접힌 상태용 대표 이름 3개를 뽑는다 — 두 표현이 어긋나지 않게 한 곳에서 만든다 */
function fromDetails(details: AttentionDetail[]) {
  return { details, samples: samplesOf(details.map((d) => d.name)) };
}

export function buildAttention(data: DashboardData): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { summary, production, quality, inventory } = data;

  if (summary) {
    if (summary.equip.stop > 0) {
      items.push({ key: "equipStop", severity: "critical", count: summary.equip.stop, samples: [], details: [], href: "/monitoring/equipment-board" });
    }
    const inspectKinds: Array<{ kind: "daily" | "periodic" | "pm"; href: string }> = [
      { kind: "daily", href: "/equipment/inspect-calendar" },
      { kind: "periodic", href: "/equipment/periodic-inspect-calendar" },
      { kind: "pm", href: "/equipment/pm-calendar" },
    ];
    for (const { kind, href } of inspectKinds) {
      const s = summary[kind];
      const equipDetail = (i: (typeof s.items)[number]): AttentionDetail =>
        ({ code: i.equipCode, name: i.equipName || i.equipCode, meta: i.lineCode ?? undefined });
      if (s.fail > 0) {
        const failed = s.items.filter((i) => i.result === "FAIL").map(equipDetail);
        items.push({ key: "inspectFail", kindKey: kind, severity: "critical", count: s.fail, ...fromDetails(failed), href });
      }
      const notDone = s.total - s.completed;
      if (notDone > 0) {
        const pending = s.items.filter((i) => !i.result).map(equipDetail);
        items.push({ key: "inspectNotDone", kindKey: kind, severity: "low", count: notDone, ...fromDetails(pending), href });
      }
    }
    if (summary.defect.wait > 0) {
      items.push({ key: "defectWait", severity: "high", count: summary.defect.wait, samples: [], details: [], href: "/quality/defect" });
    }
  }

  if (inventory) {
    // 잔여일은 부호 그대로 보여준다(D+3 = 3일 지남, D-5 = 5일 남음)
    const lotDetail = (e: (typeof inventory.expiry)[number]): AttentionDetail =>
      ({ code: e.matUid, name: e.itemName ?? e.itemCode, meta: `D${e.daysLeft >= 0 ? "-" : "+"}${Math.abs(e.daysLeft)} · ${e.expireDate}` });
    const expired = inventory.expiry.filter((e) => e.daysLeft < 0).map(lotDetail);
    if (expired.length > 0) {
      items.push({ key: "expiredLot", severity: "high", count: expired.length, ...fromDetails(expired), href: "/material/shelf-life" });
    }
    if (inventory.holds.length > 0) {
      const holds = inventory.holds.map((h): AttentionDetail => ({ code: h.ref, name: h.itemName ?? h.itemCode, meta: h.reason }));
      items.push({ key: "holdStock", severity: "high", count: holds.length, ...fromDetails(holds), href: "/inventory/product-hold" });
    }
    if (inventory.shortages.length > 0) {
      const shortages = inventory.shortages.map((s): AttentionDetail =>
        ({ code: s.itemCode, name: s.itemName ?? s.itemCode, meta: `${s.qty.toLocaleString()} / ${s.safetyStock.toLocaleString()}` }));
      items.push({ key: "shortage", severity: "medium", count: shortages.length, ...fromDetails(shortages), href: "/inventory/material-stock" });
    }
    const near = inventory.expiry.filter((e) => e.daysLeft >= 0).map(lotDetail);
    if (near.length > 0) {
      items.push({ key: "nearExpiry", severity: "medium", count: near.length, ...fromDetails(near), href: "/material/shelf-life" });
    }
  }

  if (production) {
    const hold = production.orders.filter((o) => o.status === "HOLD")
      .map((o): AttentionDetail => ({ code: o.orderNo, name: o.itemName ?? o.itemCode, meta: `${o.goodQty.toLocaleString()} / ${o.planQty.toLocaleString()}` }));
    if (hold.length > 0) {
      items.push({ key: "holdOrder", severity: "high", count: hold.length, ...fromDetails(hold), href: "/production/order" });
    }
  }

  if (quality && quality.repair.received > 0) {
    items.push({ key: "repairWait", severity: "medium", count: quality.repair.received, samples: [], details: [], href: "/production/repair" });
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count);
}

export function attentionTotal(items: AttentionItem[]): number {
  return items.reduce((s, i) => s + i.count, 0);
}
