"use client";

/**
 * @file inspection/leak-result/page.tsx
 * @description 리크(기밀) 검사 스테이션 — 통전검사 워크플로우를 inspectType만 바꿔 재사용한다.
 * 측정값 입력·스펙 대조 판정은 InspectPanel/서버가 inspectType으로 분기한다.
 */
import InspectionResultWorkflow from "../result/components/InspectionResultWorkflow";

export default function LeakInspectPage() {
  return (
    <InspectionResultWorkflow
      titleKey="inspection.leakResult.title"
      descriptionKey="inspection.leakResult.description"
      searchPlaceholderKey="inspection.leakResult.searchPlaceholder"
      selectOrderKey="inspection.leakResult.selectOrder"
      inspectType="LEAK"
    />
  );
}
