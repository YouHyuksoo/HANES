/**
 * @file src/components/layout/pageRegistry.generated.ts
 * @description 자동 생성 파일 — 직접 수정 금지. `node scripts/gen-page-registry.mjs`로 재생성.
 *              (authenticated) 영역 경로 → 페이지별 lazy dynamic factory.
 *              현재 경로의 작은 registry만 필요 시 import해 dev 서버의 전체 page compile 폭주를 피한다.
 */
import type { ComponentType } from "react";

const pageComponentCache = new Map<string, ComponentType>();
const pageComponentPromiseCache = new Map<string, Promise<ComponentType | null>>();

export async function getPageComponent(path: string): Promise<ComponentType | null> {
  const cached = pageComponentCache.get(path);
  if (cached) return cached;

  const pending = pageComponentPromiseCache.get(path);
  if (pending) return pending;

  const promise = loadPageComponent(path);
  pageComponentPromiseCache.set(path, promise);
  const component = await promise;
  if (component) pageComponentCache.set(path, component);
  pageComponentPromiseCache.delete(path);
  return component;
}

async function loadPageComponent(path: string): Promise<ComponentType | null> {
  let component: ComponentType | null = null;
  switch (path) {
    case "/consumables/issuing": {
      const mod = await import("./page-registries/consumables__issuing.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/consumables/label": {
      const mod = await import("./page-registries/consumables__label.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/consumables/life": {
      const mod = await import("./page-registries/consumables__life.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/consumables/master": {
      const mod = await import("./page-registries/consumables__master.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/consumables/mount": {
      const mod = await import("./page-registries/consumables__mount.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/consumables/receiving": {
      const mod = await import("./page-registries/consumables__receiving.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/consumables/stock": {
      const mod = await import("./page-registries/consumables__stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/customs/entry": {
      const mod = await import("./page-registries/customs__entry.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/customs/stock": {
      const mod = await import("./page-registries/customs__stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/customs/usage": {
      const mod = await import("./page-registries/customs__usage.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/dashboard": {
      const mod = await import("./page-registries/dashboard.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/calibration-history": {
      const mod = await import("./page-registries/equipment__calibration-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/daily-inspect": {
      const mod = await import("./page-registries/equipment__daily-inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/inspect-calendar": {
      const mod = await import("./page-registries/equipment__inspect-calendar.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/inspect-history": {
      const mod = await import("./page-registries/equipment__inspect-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/mold": {
      const mod = await import("./page-registries/equipment__mold.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/mold-mgmt": {
      const mod = await import("./page-registries/equipment__mold-mgmt.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/periodic-inspect": {
      const mod = await import("./page-registries/equipment__periodic-inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/periodic-inspect-calendar": {
      const mod = await import("./page-registries/equipment__periodic-inspect-calendar.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/pm-calendar": {
      const mod = await import("./page-registries/equipment__pm-calendar.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/pm-plan": {
      const mod = await import("./page-registries/equipment__pm-plan.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/pm-result": {
      const mod = await import("./page-registries/equipment__pm-result.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/equipment/status": {
      const mod = await import("./page-registries/equipment__status.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/help": {
      const mod = await import("./page-registries/help.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inspection/history": {
      const mod = await import("./page-registries/inspection__history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inspection/integrated": {
      const mod = await import("./page-registries/inspection__integrated.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inspection/protocol": {
      const mod = await import("./page-registries/inspection__protocol.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inspection/result": {
      const mod = await import("./page-registries/inspection__result.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inspection/structure": {
      const mod = await import("./page-registries/inspection__structure.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inspection/terminal-result": {
      const mod = await import("./page-registries/inspection__terminal-result.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/interface/dashboard": {
      const mod = await import("./page-registries/interface__dashboard.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/interface/log": {
      const mod = await import("./page-registries/interface__log.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/interface/manual": {
      const mod = await import("./page-registries/interface__manual.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/material-physical-inv": {
      const mod = await import("./page-registries/inventory__material-physical-inv.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/material-physical-inv-apply": {
      const mod = await import("./page-registries/inventory__material-physical-inv-apply.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/material-physical-inv-history": {
      const mod = await import("./page-registries/inventory__material-physical-inv-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/material-stock": {
      const mod = await import("./page-registries/inventory__material-stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/product-hold": {
      const mod = await import("./page-registries/inventory__product-hold.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/product-physical-inv": {
      const mod = await import("./page-registries/inventory__product-physical-inv.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/product-physical-inv-history": {
      const mod = await import("./page-registries/inventory__product-physical-inv-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/stock": {
      const mod = await import("./page-registries/inventory__stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/inventory/transaction": {
      const mod = await import("./page-registries/inventory__transaction.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/bom": {
      const mod = await import("./page-registries/master__bom.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/code": {
      const mod = await import("./page-registries/master__code.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/company": {
      const mod = await import("./page-registries/master__company.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/equip": {
      const mod = await import("./page-registries/master__equip.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/equip-inspect": {
      const mod = await import("./page-registries/master__equip-inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/equip-inspect-item": {
      const mod = await import("./page-registries/master__equip-inspect-item.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/gauge": {
      const mod = await import("./page-registries/master__gauge.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/iqc-item": {
      const mod = await import("./page-registries/master__iqc-item.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/iqc-part-spec": {
      const mod = await import("./page-registries/master__iqc-part-spec.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/label": {
      const mod = await import("./page-registries/master__label.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/part": {
      const mod = await import("./page-registries/master__part.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/partner": {
      const mod = await import("./page-registries/master__partner.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/process": {
      const mod = await import("./page-registries/master__process.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/process-capa": {
      const mod = await import("./page-registries/master__process-capa.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/prod-line": {
      const mod = await import("./page-registries/master__prod-line.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/routing": {
      const mod = await import("./page-registries/master__routing.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/vendor-barcode": {
      const mod = await import("./page-registries/master__vendor-barcode.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/warehouse": {
      const mod = await import("./page-registries/master__warehouse.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/work-calendar": {
      const mod = await import("./page-registries/master__work-calendar.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/work-instruction": {
      const mod = await import("./page-registries/master__work-instruction.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/master/worker": {
      const mod = await import("./page-registries/master__worker.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/adjustment": {
      const mod = await import("./page-registries/material__adjustment.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/arrival": {
      const mod = await import("./page-registries/material__arrival.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/arrival-result": {
      const mod = await import("./page-registries/material__arrival-result.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/arrival-stock": {
      const mod = await import("./page-registries/material__arrival-stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/arrival-transaction": {
      const mod = await import("./page-registries/material__arrival-transaction.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/concession": {
      const mod = await import("./page-registries/material__concession.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/hold": {
      const mod = await import("./page-registries/material__hold.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/iqc": {
      const mod = await import("./page-registries/material__iqc.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/iqc-history": {
      const mod = await import("./page-registries/material__iqc-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/issue": {
      const mod = await import("./page-registries/material__issue.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/issue-history": {
      const mod = await import("./page-registries/material__issue-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/issue-other": {
      const mod = await import("./page-registries/material__issue-other.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/lot": {
      const mod = await import("./page-registries/material__lot.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/lot-merge": {
      const mod = await import("./page-registries/material__lot-merge.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/lot-split": {
      const mod = await import("./page-registries/material__lot-split.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/misc-receipt": {
      const mod = await import("./page-registries/material__misc-receipt.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/physical-inv": {
      const mod = await import("./page-registries/material__physical-inv.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/physical-inv-history": {
      const mod = await import("./page-registries/material__physical-inv-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/po": {
      const mod = await import("./page-registries/material__po.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/po-status": {
      const mod = await import("./page-registries/material__po-status.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/receipt-cancel": {
      const mod = await import("./page-registries/material__receipt-cancel.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/receive": {
      const mod = await import("./page-registries/material__receive.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/receive-history": {
      const mod = await import("./page-registries/material__receive-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/receive-label": {
      const mod = await import("./page-registries/material__receive-label.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/request": {
      const mod = await import("./page-registries/material__request.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/request-other": {
      const mod = await import("./page-registries/material__request-other.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/scrap": {
      const mod = await import("./page-registries/material__scrap.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/shelf-life": {
      const mod = await import("./page-registries/material__shelf-life.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/shelf-life-history": {
      const mod = await import("./page-registries/material__shelf-life-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/shelf-life-reinspect": {
      const mod = await import("./page-registries/material__shelf-life-reinspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/stock": {
      const mod = await import("./page-registries/material__stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/material/stock-transfer": {
      const mod = await import("./page-registries/material__stock-transfer.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/outsourcing/order": {
      const mod = await import("./page-registries/outsourcing__order.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/outsourcing/receive": {
      const mod = await import("./page-registries/outsourcing__receive.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/outsourcing/vendor": {
      const mod = await import("./page-registries/outsourcing__vendor.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/product/defect-transfer": {
      const mod = await import("./page-registries/product__defect-transfer.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/product/issue": {
      const mod = await import("./page-registries/product__issue.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/product/issue-cancel": {
      const mod = await import("./page-registries/product__issue-cancel.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/product/receipt-cancel": {
      const mod = await import("./page-registries/product__receipt-cancel.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/product/receive": {
      const mod = await import("./page-registries/product__receive.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/fg-stock": {
      const mod = await import("./page-registries/production__fg-stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/input-assembly": {
      const mod = await import("./page-registries/production__input-assembly.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/input-equip": {
      const mod = await import("./page-registries/production__input-equip.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/input-inspect": {
      const mod = await import("./page-registries/production__input-inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/input-kiosk": {
      const mod = await import("./page-registries/production__input-kiosk.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/monthly-plan": {
      const mod = await import("./page-registries/production__monthly-plan.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/order": {
      const mod = await import("./page-registries/production__order.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/order-result": {
      const mod = await import("./page-registries/production__order-result.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/pack-result": {
      const mod = await import("./page-registries/production__pack-result.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/progress": {
      const mod = await import("./page-registries/production__progress.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/repair": {
      const mod = await import("./page-registries/production__repair.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/result": {
      const mod = await import("./page-registries/production__result.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/result-summary": {
      const mod = await import("./page-registries/production__result-summary.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/sample-inspect": {
      const mod = await import("./page-registries/production__sample-inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/simulation": {
      const mod = await import("./page-registries/production__simulation.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/specification-setup": {
      const mod = await import("./page-registries/production__specification-setup.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/subprocess-kitting": {
      const mod = await import("./page-registries/production__subprocess-kitting.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/wip-material-stock": {
      const mod = await import("./page-registries/production__wip-material-stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/wip-material-trans": {
      const mod = await import("./page-registries/production__wip-material-trans.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/production/wip-stock": {
      const mod = await import("./page-registries/production__wip-stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/aql": {
      const mod = await import("./page-registries/quality__aql.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/audit": {
      const mod = await import("./page-registries/quality__audit.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/capa": {
      const mod = await import("./page-registries/quality__capa.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/change-control": {
      const mod = await import("./page-registries/quality__change-control.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/complaint": {
      const mod = await import("./page-registries/quality__complaint.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/control-plan": {
      const mod = await import("./page-registries/quality__control-plan.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/defect": {
      const mod = await import("./page-registries/quality__defect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/defect-code": {
      const mod = await import("./page-registries/quality__defect-code.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/fai": {
      const mod = await import("./page-registries/quality__fai.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/inspect": {
      const mod = await import("./page-registries/quality__inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/msa": {
      const mod = await import("./page-registries/quality__msa.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/oqc": {
      const mod = await import("./page-registries/quality__oqc.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/oqc-history": {
      const mod = await import("./page-registries/quality__oqc-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/ppap": {
      const mod = await import("./page-registries/quality__ppap.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/request-inspect": {
      const mod = await import("./page-registries/quality__request-inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/rework": {
      const mod = await import("./page-registries/quality__rework.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/rework-history": {
      const mod = await import("./page-registries/quality__rework-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/rework-inspect": {
      const mod = await import("./page-registries/quality__rework-inspect.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/self-inspect-history": {
      const mod = await import("./page-registries/quality__self-inspect-history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/spc": {
      const mod = await import("./page-registries/quality__spc.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/quality/trace": {
      const mod = await import("./page-registries/quality__trace.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/sales/customer-po": {
      const mod = await import("./page-registries/sales__customer-po.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/sales/customer-po-status": {
      const mod = await import("./page-registries/sales__customer-po-status.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/box-stock": {
      const mod = await import("./page-registries/shipping__box-stock.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/confirm": {
      const mod = await import("./page-registries/shipping__confirm.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/customer-po": {
      const mod = await import("./page-registries/shipping__customer-po.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/customer-po-status": {
      const mod = await import("./page-registries/shipping__customer-po-status.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/history": {
      const mod = await import("./page-registries/shipping__history.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/order": {
      const mod = await import("./page-registries/shipping__order.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/pack": {
      const mod = await import("./page-registries/shipping__pack.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/pallet": {
      const mod = await import("./page-registries/shipping__pallet.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/pallet-ship": {
      const mod = await import("./page-registries/shipping__pallet-ship.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/shipping/return": {
      const mod = await import("./page-registries/shipping__return.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/comm-config": {
      const mod = await import("./page-registries/system__comm-config.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/config": {
      const mod = await import("./page-registries/system__config.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/department": {
      const mod = await import("./page-registries/system__department.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/document": {
      const mod = await import("./page-registries/system__document.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/er-view": {
      const mod = await import("./page-registries/system__er-view.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/improvement-requests": {
      const mod = await import("./page-registries/system__improvement-requests.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/menu-categories": {
      const mod = await import("./page-registries/system__menu-categories.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/pda-roles": {
      const mod = await import("./page-registries/system__pda-roles.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/roles": {
      const mod = await import("./page-registries/system__roles.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/scheduler": {
      const mod = await import("./page-registries/system__scheduler.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/training": {
      const mod = await import("./page-registries/system__training.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/system/users": {
      const mod = await import("./page-registries/system__users.generated");
      component = mod.getPageComponent();
      break;
    }
    case "/workflow": {
      const mod = await import("./page-registries/workflow.generated");
      component = mod.getPageComponent();
      break;
    }
    default:
      return null;
  }
  return component;
}
