import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const filesThatMustUseConfirmModal = [
  "apps/frontend/src/components/master/RoutingTab.tsx",
  "apps/frontend/src/components/master/ProdLineTab.tsx",
  "apps/frontend/src/components/master/ProcessTab.tsx",
  "apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableUsageMapPanel.tsx",
  "apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableFormPanel.tsx",
  "apps/frontend/src/app/(authenticated)/system/users/components/UserFormPanel.tsx",
  "apps/frontend/src/app/(authenticated)/system/training/components/TrainingResultList.tsx",
  "apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx",
  "apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx",
  "apps/frontend/src/app/(authenticated)/master/equip-inspect/components/InspectItemPanel.tsx",
  "apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx",
  "apps/frontend/src/app/(authenticated)/master/process/page.tsx",
  "apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx",
  "apps/frontend/src/app/(authenticated)/master/label/components/TemplateManager.tsx",
  "apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcTemplatePickerModal.tsx",
  "apps/frontend/src/app/(authenticated)/master/routing/components/SelfInspectConfigEditor.tsx",
  "apps/frontend/src/app/(authenticated)/quality/audit/components/AuditFindingList.tsx",
  "apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanItemList.tsx",
];

const forbiddenDirectDeleteClicks = [
  "handleDelete(row.original)",
  "handleDelete(idx)",
  "handleDelete(tpl.templateKey)",
  "handleDelete(row.planNo, row.workerCode)",
  "handleRemove(row.planNo, row.workerCode)",
  "handleRemoveBox(box.boxNo)",
  "handleRemoveSerial(serial)",
  "handleRemoveSerial(lastAddedSerial)",
  "handleRemoveEquipment",
  "onClick={handleImageClear}",
  "onClick={handleImageRemove}",
];

test("all known destructive delete buttons are guarded by ConfirmModal", () => {
  for (const file of filesThatMustUseConfirmModal) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /ConfirmModal/, `${file} must use the shared ConfirmModal`);
    assert.match(source, /variant=["']danger["']/, `${file} delete confirmation must use danger variant`);
  }
});

test("known delete buttons do not call delete handlers directly from click handlers", () => {
  const combined = filesThatMustUseConfirmModal
    .map((file) => `${file}\n${readFileSync(file, "utf8")}`)
    .join("\n");

  for (const forbidden of forbiddenDirectDeleteClicks) {
    assert.equal(
      combined.includes(forbidden),
      false,
      `delete click must open a confirm modal instead of calling ${forbidden}`,
    );
  }
});
