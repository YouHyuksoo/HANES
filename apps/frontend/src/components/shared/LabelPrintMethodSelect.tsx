"use client";

/**
 * @file components/shared/LabelPrintMethodSelect.tsx
 * @description 라벨 출력 방식(브라우저 인쇄 / Print Agent) 선택 — 모든 라벨 출력 화면과 헤더 에이전트 메뉴가 공유.
 *
 * 값은 이 PC 의 localStorage(LABEL_PRINT_METHOD_STORAGE_KEY)에 저장되며, 키오스크 자동 출력 호스트도
 * 같은 값을 읽는다. http 공인 주소(hswbs)에서는 브라우저 정책으로 Print Agent 에 연결할 수 없어
 * 기본값은 BROWSER 다.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import {
  LabelPrintMethod,
  readStoredLabelPrintMethod,
  storeLabelPrintMethod,
} from "@/services/label-print";

interface Props {
  /** 제어형으로 쓸 때 현재 값. 생략하면 컴포넌트가 localStorage 값을 스스로 관리한다 */
  value?: LabelPrintMethod;
  onChange?: (method: LabelPrintMethod) => void;
  className?: string;
  fullWidth?: boolean;
}

export function useLabelPrintMethod(): [LabelPrintMethod, (method: LabelPrintMethod) => void] {
  const [method, setMethod] = useState<LabelPrintMethod>("BROWSER");
  useEffect(() => {
    setMethod(readStoredLabelPrintMethod());
  }, []);
  const update = (next: LabelPrintMethod) => {
    setMethod(next);
    storeLabelPrintMethod(next);
  };
  return [method, update];
}

export default function LabelPrintMethodSelect({ value, onChange, className = "", fullWidth = true }: Props) {
  const { t } = useTranslation();
  const [internal, setInternal] = useLabelPrintMethod();
  const current = value ?? internal;

  const options = useMemo<SelectOption[]>(() => [
    { value: "BROWSER", label: t("labelPrint.methodBrowser", "브라우저 인쇄") },
    { value: "AGENT", label: t("labelPrint.methodAgent", "Print Agent 출력") },
  ], [t]);

  return (
    <div className={className}>
      <Select
        aria-label={t("labelPrint.method", "라벨 출력 방식")}
        options={options}
        value={current}
        onChange={(next) => {
          const method: LabelPrintMethod = next === "AGENT" ? "AGENT" : "BROWSER";
          setInternal(method);
          onChange?.(method);
        }}
        fullWidth={fullWidth}
      />
    </div>
  );
}
