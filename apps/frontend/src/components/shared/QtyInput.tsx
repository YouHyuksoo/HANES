"use client";

/**
 * @file components/shared/QtyInput.tsx
 * @description 천단위 콤마로 표시되는 수량 입력 컴포넌트.
 *
 * 브라우저의 `<input type="number">`는 천단위 구분 기호를 표시하지 못한다.
 * 이 컴포넌트는 내부적으로 text 입력을 쓰고 표시값을 `toLocaleString()`으로 포맷하며,
 * 입력은 숫자만 추출해 숫자값으로 emit한다.
 *
 * 사용 예:
 *   <QtyInput value={qty} onChange={setQty} maxValue={remaining} fullWidth />
 */
import { Input, type InputProps } from "@/components/ui";

export type QtyInputProps = Omit<InputProps, "value" | "onChange" | "type"> & {
  /** 숫자값 */
  value: number;
  /** 숫자값 변경 콜백 */
  onChange: (value: number) => void;
  /** 최대값(초과 입력 시 클램프). 미지정 시 클램프하지 않는다. */
  maxValue?: number;
};

export default function QtyInput({ value, onChange, maxValue, ...rest }: QtyInputProps) {
  const display = value ? value.toLocaleString() : "";

  return (
    <Input
      {...rest}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "");
        let next = digits ? Number(digits) : 0;
        if (typeof maxValue === "number") next = Math.min(next, maxValue);
        onChange(next);
      }}
    />
  );
}
