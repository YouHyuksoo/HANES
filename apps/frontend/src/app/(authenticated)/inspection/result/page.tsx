"use client";

import InspectionResultWorkflow from "./components/InspectionResultWorkflow";

export default function ContinuityInspectPage() {
  return (
    <InspectionResultWorkflow
      titleKey="inspection.result.title"
      descriptionKey="inspection.result.description"
      searchPlaceholderKey="inspection.result.searchPlaceholder"
      selectOrderKey="inspection.result.selectOrder"
      inspectType="CONTINUITY"
      finishedOnly
    />
  );
}
