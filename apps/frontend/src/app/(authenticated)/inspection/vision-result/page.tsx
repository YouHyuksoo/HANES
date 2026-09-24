"use client";

import InspectionResultWorkflow from "../result/components/InspectionResultWorkflow";

export default function VisionInspectionPage() {
  return <InspectionResultWorkflow titleKey="inspection.visionResult.title" descriptionKey="inspection.visionResult.description" searchPlaceholderKey="inspection.visionResult.searchPlaceholder" selectOrderKey="inspection.visionResult.selectOrder" inspectType="VISION" finishedOnly />;
}
