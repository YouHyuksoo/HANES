"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { ScanBarcode } from "lucide-react";
import Input, { type InputProps } from "@/components/ui/Input";
import { useScanInputFocus } from "@/hooks/useScanInputFocus";
import { useSerialStore } from "@/stores/serialStore";

export interface BarcodeScanInputProps
  extends Omit<InputProps, "value" | "onChange" | "onKeyDown" | "leftIcon"> {
  value?: string;
  onChange?: (value: string) => void;
  onScan: (value: string) => void | Promise<void>;
  autoClear?: boolean;
  maintainFocus?: boolean;
  primaryFocus?: boolean;
  serialEnabled?: boolean;
  serialFocusedOnly?: boolean;
  blinkIndicator?: boolean;
  refocusAfterScan?: boolean;
}

function normalizeScanValue(value: string): string {
  return value.replace(/\r?\n|\r/g, "").trim();
}

const BarcodeScanInput = forwardRef<HTMLInputElement, BarcodeScanInputProps>(
  (
    {
      value: controlledValue,
      onChange,
      onScan,
      autoClear = false,
      maintainFocus = true,
      primaryFocus = false,
      serialEnabled = true,
      serialFocusedOnly = true,
      blinkIndicator = true,
      refocusAfterScan = true,
      className = "",
      disabled,
      autoComplete = "off",
      autoCorrect = "off",
      autoCapitalize = "off",
      spellCheck = false,
      type = "text",
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [internalValue, setInternalValue] = useState("");
    const subscribeSerialScan = useSerialStore((state) => state.onScan);

    const value = controlledValue ?? internalValue;
    const setValue = useCallback(
      (nextValue: string) => {
        if (onChange) onChange(nextValue);
        else setInternalValue(nextValue);
      },
      [onChange],
    );

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);
    useScanInputFocus(inputRef, maintainFocus && !disabled, { primary: primaryFocus });

    const focusInput = useCallback(() => {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    const submitValue = useCallback(
      async (rawValue: string) => {
        const scanned = normalizeScanValue(rawValue);
        if (!scanned || disabled) {
          if (refocusAfterScan) focusInput();
          return;
        }

        setValue(autoClear ? "" : scanned);
        try {
          await onScan(scanned);
        } finally {
          if (refocusAfterScan) focusInput();
        }
      },
      [autoClear, disabled, focusInput, onScan, refocusAfterScan, setValue],
    );

    useEffect(() => {
      if (!serialEnabled || disabled) return;

      return subscribeSerialScan((rawValue) => {
        if (serialFocusedOnly && document.activeElement !== inputRef.current) return;
        void submitValue(rawValue);
      });
    }, [disabled, serialEnabled, serialFocusedOnly, submitValue, subscribeSerialScan]);

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
      },
      [setValue],
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submitValue(event.currentTarget.value);
        }
      },
      [submitValue],
    );

    const blinkClassName = blinkIndicator && !disabled
      ? "border-primary/70 ring-2 ring-primary/20 animate-pulse"
      : "";

    return (
      <Input
        ref={inputRef}
        type={type}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        leftIcon={
          <ScanBarcode
            className={`w-4 h-4 ${blinkIndicator && !disabled ? "text-primary animate-pulse" : ""}`}
          />
        }
        className={`${blinkClassName} ${className}`.trim()}
        {...props}
      />
    );
  },
);

BarcodeScanInput.displayName = "BarcodeScanInput";

export default BarcodeScanInput;
