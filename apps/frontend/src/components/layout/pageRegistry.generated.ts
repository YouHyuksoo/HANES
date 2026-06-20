/**
 * @file src/components/layout/pageRegistry.generated.ts
 * @description 자동 생성 파일 — 직접 수정 금지. `node scripts/gen-page-registry.mjs`로 재생성.
 *              (authenticated) 영역 경로 → 페이지 컴포넌트 lazy dynamic factory.
 *              호출된 경로만 dynamic 생성해 dev 서버의 전체 page compile 폭주를 피한다.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const pageComponentCache = new Map<string, ComponentType>();

export function getPageComponent(path: string): ComponentType | null {
  const cached = pageComponentCache.get(path);
  if (cached) return cached;

  let component: ComponentType | null = null;
  switch (path) {
    case "/consumables/issuing":
      component = dynamic(() => import("@/app/(authenticated)/consumables/issuing/page"), { ssr: false });
      break;
    case "/consumables/label":
      component = dynamic(() => import("@/app/(authenticated)/consumables/label/page"), { ssr: false });
      break;
    case "/consumables/life":
      component = dynamic(() => import("@/app/(authenticated)/consumables/life/page"), { ssr: false });
      break;
    case "/consumables/master":
      component = dynamic(() => import("@/app/(authenticated)/consumables/master/page"), { ssr: false });
      break;
    case "/consumables/mount":
      component = dynamic(() => import("@/app/(authenticated)/consumables/mount/page"), { ssr: false });
      break;
    case "/consumables/receiving":
      component = dynamic(() => import("@/app/(authenticated)/consumables/receiving/page"), { ssr: false });
      break;
    case "/consumables/stock":
      component = dynamic(() => import("@/app/(authenticated)/consumables/stock/page"), { ssr: false });
      break;
    case "/customs/entry":
      component = dynamic(() => import("@/app/(authenticated)/customs/entry/page"), { ssr: false });
      break;
    case "/customs/stock":
      component = dynamic(() => import("@/app/(authenticated)/customs/stock/page"), { ssr: false });
      break;
    case "/customs/usage":
      component = dynamic(() => import("@/app/(authenticated)/customs/usage/page"), { ssr: false });
      break;
    case "/dashboard":
      component = dynamic(() => import("@/app/(authenticated)/dashboard/page"), { ssr: false });
      break;
    case "/equipment/calibration-history":
      component = dynamic(() => import("@/app/(authenticated)/equipment/calibration-history/page"), { ssr: false });
      break;
    case "/equipment/daily-inspect":
      component = dynamic(() => import("@/app/(authenticated)/equipment/daily-inspect/page"), { ssr: false });
      break;
    case "/equipment/inspect-calendar":
      component = dynamic(() => import("@/app/(authenticated)/equipment/inspect-calendar/page"), { ssr: false });
      break;
    case "/equipment/inspect-history":
      component = dynamic(() => import("@/app/(authenticated)/equipment/inspect-history/page"), { ssr: false });
      break;
    case "/equipment/mold":
      component = dynamic(() => import("@/app/(authenticated)/equipment/mold/page"), { ssr: false });
      break;
    case "/equipment/mold-mgmt":
      component = dynamic(() => import("@/app/(authenticated)/equipment/mold-mgmt/page"), { ssr: false });
      break;
    case "/equipment/periodic-inspect":
      component = dynamic(() => import("@/app/(authenticated)/equipment/periodic-inspect/page"), { ssr: false });
      break;
    case "/equipment/periodic-inspect-calendar":
      component = dynamic(() => import("@/app/(authenticated)/equipment/periodic-inspect-calendar/page"), { ssr: false });
      break;
    case "/equipment/pm-calendar":
      component = dynamic(() => import("@/app/(authenticated)/equipment/pm-calendar/page"), { ssr: false });
      break;
    case "/equipment/pm-plan":
      component = dynamic(() => import("@/app/(authenticated)/equipment/pm-plan/page"), { ssr: false });
      break;
    case "/equipment/pm-result":
      component = dynamic(() => import("@/app/(authenticated)/equipment/pm-result/page"), { ssr: false });
      break;
    case "/equipment/status":
      component = dynamic(() => import("@/app/(authenticated)/equipment/status/page"), { ssr: false });
      break;
    case "/inspection/history":
      component = dynamic(() => import("@/app/(authenticated)/inspection/history/page"), { ssr: false });
      break;
    case "/inspection/protocol":
      component = dynamic(() => import("@/app/(authenticated)/inspection/protocol/page"), { ssr: false });
      break;
    case "/inspection/result":
      component = dynamic(() => import("@/app/(authenticated)/inspection/result/page"), { ssr: false });
      break;
    case "/inspection/terminal-result":
      component = dynamic(() => import("@/app/(authenticated)/inspection/terminal-result/page"), { ssr: false });
      break;
    case "/interface/dashboard":
      component = dynamic(() => import("@/app/(authenticated)/interface/dashboard/page"), { ssr: false });
      break;
    case "/interface/log":
      component = dynamic(() => import("@/app/(authenticated)/interface/log/page"), { ssr: false });
      break;
    case "/interface/manual":
      component = dynamic(() => import("@/app/(authenticated)/interface/manual/page"), { ssr: false });
      break;
    case "/inventory/material-physical-inv":
      component = dynamic(() => import("@/app/(authenticated)/inventory/material-physical-inv/page"), { ssr: false });
      break;
    case "/inventory/material-physical-inv-apply":
      component = dynamic(() => import("@/app/(authenticated)/inventory/material-physical-inv-apply/page"), { ssr: false });
      break;
    case "/inventory/material-physical-inv-history":
      component = dynamic(() => import("@/app/(authenticated)/inventory/material-physical-inv-history/page"), { ssr: false });
      break;
    case "/inventory/material-stock":
      component = dynamic(() => import("@/app/(authenticated)/inventory/material-stock/page"), { ssr: false });
      break;
    case "/inventory/product-hold":
      component = dynamic(() => import("@/app/(authenticated)/inventory/product-hold/page"), { ssr: false });
      break;
    case "/inventory/product-physical-inv":
      component = dynamic(() => import("@/app/(authenticated)/inventory/product-physical-inv/page"), { ssr: false });
      break;
    case "/inventory/product-physical-inv-history":
      component = dynamic(() => import("@/app/(authenticated)/inventory/product-physical-inv-history/page"), { ssr: false });
      break;
    case "/inventory/stock":
      component = dynamic(() => import("@/app/(authenticated)/inventory/stock/page"), { ssr: false });
      break;
    case "/inventory/transaction":
      component = dynamic(() => import("@/app/(authenticated)/inventory/transaction/page"), { ssr: false });
      break;
    case "/master/bom":
      component = dynamic(() => import("@/app/(authenticated)/master/bom/page"), { ssr: false });
      break;
    case "/master/code":
      component = dynamic(() => import("@/app/(authenticated)/master/code/page"), { ssr: false });
      break;
    case "/master/company":
      component = dynamic(() => import("@/app/(authenticated)/master/company/page"), { ssr: false });
      break;
    case "/master/equip":
      component = dynamic(() => import("@/app/(authenticated)/master/equip/page"), { ssr: false });
      break;
    case "/master/equip-inspect":
      component = dynamic(() => import("@/app/(authenticated)/master/equip-inspect/page"), { ssr: false });
      break;
    case "/master/equip-inspect-item":
      component = dynamic(() => import("@/app/(authenticated)/master/equip-inspect-item/page"), { ssr: false });
      break;
    case "/master/gauge":
      component = dynamic(() => import("@/app/(authenticated)/master/gauge/page"), { ssr: false });
      break;
    case "/master/iqc-item":
      component = dynamic(() => import("@/app/(authenticated)/master/iqc-item/page"), { ssr: false });
      break;
    case "/master/iqc-part-spec":
      component = dynamic(() => import("@/app/(authenticated)/master/iqc-part-spec/page"), { ssr: false });
      break;
    case "/master/label":
      component = dynamic(() => import("@/app/(authenticated)/master/label/page"), { ssr: false });
      break;
    case "/master/part":
      component = dynamic(() => import("@/app/(authenticated)/master/part/page"), { ssr: false });
      break;
    case "/master/partner":
      component = dynamic(() => import("@/app/(authenticated)/master/partner/page"), { ssr: false });
      break;
    case "/master/process":
      component = dynamic(() => import("@/app/(authenticated)/master/process/page"), { ssr: false });
      break;
    case "/master/process-capa":
      component = dynamic(() => import("@/app/(authenticated)/master/process-capa/page"), { ssr: false });
      break;
    case "/master/prod-line":
      component = dynamic(() => import("@/app/(authenticated)/master/prod-line/page"), { ssr: false });
      break;
    case "/master/routing":
      component = dynamic(() => import("@/app/(authenticated)/master/routing/page"), { ssr: false });
      break;
    case "/master/vendor-barcode":
      component = dynamic(() => import("@/app/(authenticated)/master/vendor-barcode/page"), { ssr: false });
      break;
    case "/master/warehouse":
      component = dynamic(() => import("@/app/(authenticated)/master/warehouse/page"), { ssr: false });
      break;
    case "/master/work-calendar":
      component = dynamic(() => import("@/app/(authenticated)/master/work-calendar/page"), { ssr: false });
      break;
    case "/master/work-instruction":
      component = dynamic(() => import("@/app/(authenticated)/master/work-instruction/page"), { ssr: false });
      break;
    case "/master/worker":
      component = dynamic(() => import("@/app/(authenticated)/master/worker/page"), { ssr: false });
      break;
    case "/material/adjustment":
      component = dynamic(() => import("@/app/(authenticated)/material/adjustment/page"), { ssr: false });
      break;
    case "/material/arrival":
      component = dynamic(() => import("@/app/(authenticated)/material/arrival/page"), { ssr: false });
      break;
    case "/material/arrival-result":
      component = dynamic(() => import("@/app/(authenticated)/material/arrival-result/page"), { ssr: false });
      break;
    case "/material/arrival-stock":
      component = dynamic(() => import("@/app/(authenticated)/material/arrival-stock/page"), { ssr: false });
      break;
    case "/material/arrival-transaction":
      component = dynamic(() => import("@/app/(authenticated)/material/arrival-transaction/page"), { ssr: false });
      break;
    case "/material/concession":
      component = dynamic(() => import("@/app/(authenticated)/material/concession/page"), { ssr: false });
      break;
    case "/material/hold":
      component = dynamic(() => import("@/app/(authenticated)/material/hold/page"), { ssr: false });
      break;
    case "/material/iqc":
      component = dynamic(() => import("@/app/(authenticated)/material/iqc/page"), { ssr: false });
      break;
    case "/material/iqc-history":
      component = dynamic(() => import("@/app/(authenticated)/material/iqc-history/page"), { ssr: false });
      break;
    case "/material/issue":
      component = dynamic(() => import("@/app/(authenticated)/material/issue/page"), { ssr: false });
      break;
    case "/material/issue-other":
      component = dynamic(() => import("@/app/(authenticated)/material/issue-other/page"), { ssr: false });
      break;
    case "/material/lot":
      component = dynamic(() => import("@/app/(authenticated)/material/lot/page"), { ssr: false });
      break;
    case "/material/lot-merge":
      component = dynamic(() => import("@/app/(authenticated)/material/lot-merge/page"), { ssr: false });
      break;
    case "/material/lot-split":
      component = dynamic(() => import("@/app/(authenticated)/material/lot-split/page"), { ssr: false });
      break;
    case "/material/misc-receipt":
      component = dynamic(() => import("@/app/(authenticated)/material/misc-receipt/page"), { ssr: false });
      break;
    case "/material/physical-inv":
      component = dynamic(() => import("@/app/(authenticated)/material/physical-inv/page"), { ssr: false });
      break;
    case "/material/physical-inv-history":
      component = dynamic(() => import("@/app/(authenticated)/material/physical-inv-history/page"), { ssr: false });
      break;
    case "/material/po":
      component = dynamic(() => import("@/app/(authenticated)/material/po/page"), { ssr: false });
      break;
    case "/material/po-status":
      component = dynamic(() => import("@/app/(authenticated)/material/po-status/page"), { ssr: false });
      break;
    case "/material/receipt-cancel":
      component = dynamic(() => import("@/app/(authenticated)/material/receipt-cancel/page"), { ssr: false });
      break;
    case "/material/receive":
      component = dynamic(() => import("@/app/(authenticated)/material/receive/page"), { ssr: false });
      break;
    case "/material/receive-history":
      component = dynamic(() => import("@/app/(authenticated)/material/receive-history/page"), { ssr: false });
      break;
    case "/material/receive-label":
      component = dynamic(() => import("@/app/(authenticated)/material/receive-label/page"), { ssr: false });
      break;
    case "/material/request":
      component = dynamic(() => import("@/app/(authenticated)/material/request/page"), { ssr: false });
      break;
    case "/material/scrap":
      component = dynamic(() => import("@/app/(authenticated)/material/scrap/page"), { ssr: false });
      break;
    case "/material/shelf-life":
      component = dynamic(() => import("@/app/(authenticated)/material/shelf-life/page"), { ssr: false });
      break;
    case "/material/shelf-life-history":
      component = dynamic(() => import("@/app/(authenticated)/material/shelf-life-history/page"), { ssr: false });
      break;
    case "/material/shelf-life-reinspect":
      component = dynamic(() => import("@/app/(authenticated)/material/shelf-life-reinspect/page"), { ssr: false });
      break;
    case "/material/stock":
      component = dynamic(() => import("@/app/(authenticated)/material/stock/page"), { ssr: false });
      break;
    case "/outsourcing/order":
      component = dynamic(() => import("@/app/(authenticated)/outsourcing/order/page"), { ssr: false });
      break;
    case "/outsourcing/receive":
      component = dynamic(() => import("@/app/(authenticated)/outsourcing/receive/page"), { ssr: false });
      break;
    case "/outsourcing/vendor":
      component = dynamic(() => import("@/app/(authenticated)/outsourcing/vendor/page"), { ssr: false });
      break;
    case "/product/issue":
      component = dynamic(() => import("@/app/(authenticated)/product/issue/page"), { ssr: false });
      break;
    case "/product/issue-cancel":
      component = dynamic(() => import("@/app/(authenticated)/product/issue-cancel/page"), { ssr: false });
      break;
    case "/product/receipt-cancel":
      component = dynamic(() => import("@/app/(authenticated)/product/receipt-cancel/page"), { ssr: false });
      break;
    case "/product/receive":
      component = dynamic(() => import("@/app/(authenticated)/product/receive/page"), { ssr: false });
      break;
    case "/production/input-equip":
      component = dynamic(() => import("@/app/(authenticated)/production/input-equip/page"), { ssr: false });
      break;
    case "/production/input-inspect":
      component = dynamic(() => import("@/app/(authenticated)/production/input-inspect/page"), { ssr: false });
      break;
    case "/production/input-kiosk":
      component = dynamic(() => import("@/app/(authenticated)/production/input-kiosk/page"), { ssr: false });
      break;
    case "/production/input-machine":
      component = dynamic(() => import("@/app/(authenticated)/production/input-machine/page"), { ssr: false });
      break;
    case "/production/input-manual":
      component = dynamic(() => import("@/app/(authenticated)/production/input-manual/page"), { ssr: false });
      break;
    case "/production/monthly-plan":
      component = dynamic(() => import("@/app/(authenticated)/production/monthly-plan/page"), { ssr: false });
      break;
    case "/production/order":
      component = dynamic(() => import("@/app/(authenticated)/production/order/page"), { ssr: false });
      break;
    case "/production/pack-result":
      component = dynamic(() => import("@/app/(authenticated)/production/pack-result/page"), { ssr: false });
      break;
    case "/production/progress":
      component = dynamic(() => import("@/app/(authenticated)/production/progress/page"), { ssr: false });
      break;
    case "/production/repair":
      component = dynamic(() => import("@/app/(authenticated)/production/repair/page"), { ssr: false });
      break;
    case "/production/result":
      component = dynamic(() => import("@/app/(authenticated)/production/result/page"), { ssr: false });
      break;
    case "/production/result-summary":
      component = dynamic(() => import("@/app/(authenticated)/production/result-summary/page"), { ssr: false });
      break;
    case "/production/sample-inspect":
      component = dynamic(() => import("@/app/(authenticated)/production/sample-inspect/page"), { ssr: false });
      break;
    case "/production/simulation":
      component = dynamic(() => import("@/app/(authenticated)/production/simulation/page"), { ssr: false });
      break;
    case "/production/specification-setup":
      component = dynamic(() => import("@/app/(authenticated)/production/specification-setup/page"), { ssr: false });
      break;
    case "/production/subprocess-kitting":
      component = dynamic(() => import("@/app/(authenticated)/production/subprocess-kitting/page"), { ssr: false });
      break;
    case "/production/wip-material-stock":
      component = dynamic(() => import("@/app/(authenticated)/production/wip-material-stock/page"), { ssr: false });
      break;
    case "/production/wip-material-trans":
      component = dynamic(() => import("@/app/(authenticated)/production/wip-material-trans/page"), { ssr: false });
      break;
    case "/production/wip-stock":
      component = dynamic(() => import("@/app/(authenticated)/production/wip-stock/page"), { ssr: false });
      break;
    case "/quality/aql":
      component = dynamic(() => import("@/app/(authenticated)/quality/aql/page"), { ssr: false });
      break;
    case "/quality/audit":
      component = dynamic(() => import("@/app/(authenticated)/quality/audit/page"), { ssr: false });
      break;
    case "/quality/capa":
      component = dynamic(() => import("@/app/(authenticated)/quality/capa/page"), { ssr: false });
      break;
    case "/quality/change-control":
      component = dynamic(() => import("@/app/(authenticated)/quality/change-control/page"), { ssr: false });
      break;
    case "/quality/complaint":
      component = dynamic(() => import("@/app/(authenticated)/quality/complaint/page"), { ssr: false });
      break;
    case "/quality/control-plan":
      component = dynamic(() => import("@/app/(authenticated)/quality/control-plan/page"), { ssr: false });
      break;
    case "/quality/defect":
      component = dynamic(() => import("@/app/(authenticated)/quality/defect/page"), { ssr: false });
      break;
    case "/quality/fai":
      component = dynamic(() => import("@/app/(authenticated)/quality/fai/page"), { ssr: false });
      break;
    case "/quality/inspect":
      component = dynamic(() => import("@/app/(authenticated)/quality/inspect/page"), { ssr: false });
      break;
    case "/quality/msa":
      component = dynamic(() => import("@/app/(authenticated)/quality/msa/page"), { ssr: false });
      break;
    case "/quality/oqc":
      component = dynamic(() => import("@/app/(authenticated)/quality/oqc/page"), { ssr: false });
      break;
    case "/quality/oqc-history":
      component = dynamic(() => import("@/app/(authenticated)/quality/oqc-history/page"), { ssr: false });
      break;
    case "/quality/ppap":
      component = dynamic(() => import("@/app/(authenticated)/quality/ppap/page"), { ssr: false });
      break;
    case "/quality/request-inspect":
      component = dynamic(() => import("@/app/(authenticated)/quality/request-inspect/page"), { ssr: false });
      break;
    case "/quality/rework":
      component = dynamic(() => import("@/app/(authenticated)/quality/rework/page"), { ssr: false });
      break;
    case "/quality/rework-history":
      component = dynamic(() => import("@/app/(authenticated)/quality/rework-history/page"), { ssr: false });
      break;
    case "/quality/rework-inspect":
      component = dynamic(() => import("@/app/(authenticated)/quality/rework-inspect/page"), { ssr: false });
      break;
    case "/quality/self-inspect-history":
      component = dynamic(() => import("@/app/(authenticated)/quality/self-inspect-history/page"), { ssr: false });
      break;
    case "/quality/spc":
      component = dynamic(() => import("@/app/(authenticated)/quality/spc/page"), { ssr: false });
      break;
    case "/quality/trace":
      component = dynamic(() => import("@/app/(authenticated)/quality/trace/page"), { ssr: false });
      break;
    case "/sales/customer-po":
      component = dynamic(() => import("@/app/(authenticated)/sales/customer-po/page"), { ssr: false });
      break;
    case "/sales/customer-po-status":
      component = dynamic(() => import("@/app/(authenticated)/sales/customer-po-status/page"), { ssr: false });
      break;
    case "/shipping/box-stock":
      component = dynamic(() => import("@/app/(authenticated)/shipping/box-stock/page"), { ssr: false });
      break;
    case "/shipping/confirm":
      component = dynamic(() => import("@/app/(authenticated)/shipping/confirm/page"), { ssr: false });
      break;
    case "/shipping/customer-po":
      component = dynamic(() => import("@/app/(authenticated)/shipping/customer-po/page"), { ssr: false });
      break;
    case "/shipping/customer-po-status":
      component = dynamic(() => import("@/app/(authenticated)/shipping/customer-po-status/page"), { ssr: false });
      break;
    case "/shipping/history":
      component = dynamic(() => import("@/app/(authenticated)/shipping/history/page"), { ssr: false });
      break;
    case "/shipping/order":
      component = dynamic(() => import("@/app/(authenticated)/shipping/order/page"), { ssr: false });
      break;
    case "/shipping/pack":
      component = dynamic(() => import("@/app/(authenticated)/shipping/pack/page"), { ssr: false });
      break;
    case "/shipping/pallet":
      component = dynamic(() => import("@/app/(authenticated)/shipping/pallet/page"), { ssr: false });
      break;
    case "/shipping/return":
      component = dynamic(() => import("@/app/(authenticated)/shipping/return/page"), { ssr: false });
      break;
    case "/system/comm-config":
      component = dynamic(() => import("@/app/(authenticated)/system/comm-config/page"), { ssr: false });
      break;
    case "/system/config":
      component = dynamic(() => import("@/app/(authenticated)/system/config/page"), { ssr: false });
      break;
    case "/system/department":
      component = dynamic(() => import("@/app/(authenticated)/system/department/page"), { ssr: false });
      break;
    case "/system/document":
      component = dynamic(() => import("@/app/(authenticated)/system/document/page"), { ssr: false });
      break;
    case "/system/improvement-requests":
      component = dynamic(() => import("@/app/(authenticated)/system/improvement-requests/page"), { ssr: false });
      break;
    case "/system/menu-categories":
      component = dynamic(() => import("@/app/(authenticated)/system/menu-categories/page"), { ssr: false });
      break;
    case "/system/pda-roles":
      component = dynamic(() => import("@/app/(authenticated)/system/pda-roles/page"), { ssr: false });
      break;
    case "/system/roles":
      component = dynamic(() => import("@/app/(authenticated)/system/roles/page"), { ssr: false });
      break;
    case "/system/scheduler":
      component = dynamic(() => import("@/app/(authenticated)/system/scheduler/page"), { ssr: false });
      break;
    case "/system/training":
      component = dynamic(() => import("@/app/(authenticated)/system/training/page"), { ssr: false });
      break;
    case "/system/users":
      component = dynamic(() => import("@/app/(authenticated)/system/users/page"), { ssr: false });
      break;
    case "/workflow":
      component = dynamic(() => import("@/app/(authenticated)/workflow/page"), { ssr: false });
      break;
    default:
      return null;
  }

  pageComponentCache.set(path, component);
  return component;
}
