"use client";

import InspectionResultWorkflow from "../result/components/InspectionResultWorkflow";

export default function RelayInspectionPage() {
  return <InspectionResultWorkflow titleKey="inspection.relayResult.title" descriptionKey="inspection.relayResult.description" searchPlaceholderKey="inspection.relayResult.searchPlaceholder" selectOrderKey="inspection.relayResult.selectOrder" inspectType="RELAY_FUNCTION" finishedOnly />;
}
