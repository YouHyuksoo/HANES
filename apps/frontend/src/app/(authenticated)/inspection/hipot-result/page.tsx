"use client";

/**
 * @file inspection/hipot-result/page.tsx
 * @description 내전압(절연저항 포함) 검사 스테이션 — 통전검사 워크플로우를 inspectType만 바꿔 재사용한다.
 * 측정값 입력·스펙 대조 판정은 InspectPanel/서버가 inspectType으로 분기한다.
 */
import InspectionResultWorkflow from "../result/components/InspectionResultWorkflow";

export default function HipotInspectPage() {
  return (
    <InspectionResultWorkflow
      titleKey="inspection.hipotResult.title"
      descriptionKey="inspection.hipotResult.description"
      searchPlaceholderKey="inspection.hipotResult.searchPlaceholder"
      selectOrderKey="inspection.hipotResult.selectOrder"
      inspectType="HIPOT"
    />
  );
}
