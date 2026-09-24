"use client";

import InspectionResultWorkflow from "../result/components/InspectionResultWorkflow";

export default function TorqueInspectionPage() {
  return <InspectionResultWorkflow titleKey="inspection.torqueResult.title" descriptionKey="inspection.torqueResult.description" searchPlaceholderKey="inspection.torqueResult.searchPlaceholder" selectOrderKey="inspection.torqueResult.selectOrder" inspectType="TORQUE" finishedOnly />;
}
