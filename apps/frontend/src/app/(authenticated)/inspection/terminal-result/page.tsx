"use client";

import InspectionResultWorkflow from "../result/components/InspectionResultWorkflow";

export default function TerminalInspectPage() {
  return (
    <InspectionResultWorkflow
      titleKey="inspection.terminalResult.title"
      descriptionKey="inspection.terminalResult.description"
      searchPlaceholderKey="inspection.terminalResult.searchPlaceholder"
      selectOrderKey="inspection.terminalResult.selectOrder"
      inspectType="TERMINAL"
    />
  );
}
