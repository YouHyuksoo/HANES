"use client";

/**
 * @file components/shared/field-help/createFieldHelp.tsx
 * @description 화면별 필드/컬럼 도움말(?) 공통 팩토리 — 폼 라벨과 그리드 컬럼 헤더 양쪽에 같은 도움말 사전을 재사용한다.
 *
 * 초보자 가이드:
 * 1. 화면 폴더에 `xxxFieldHelp.tsx`를 만들고 필드별 { db, description } 사전을 정의한다.
 *    ```ts
 *    export const CONSUMABLE_FIELD_HELP = {
 *      consumableCode: { db: "CONSUMABLE_MASTERS.CONSUMABLE_CODE", description: "소모품을 식별하는 고유 코드입니다." },
 *    } as const;
 *    export const { FieldInput, FieldComCodeSelect, headerWithHelp } =
 *      createFieldHelp(CONSUMABLE_FIELD_HELP, "consumables.master.fieldHelp");
 *    ```
 * 2. 폼: `<Input label=... />` → `<FieldInput field="consumableCode" label=... />` 로 바꾸면 라벨 옆에 ? 가 붙는다.
 * 3. 그리드: `header: t("...")` → `header: headerWithHelp("consumableCode", t("..."))` 로 바꾸면 헤더에 ? 가 붙는다.
 * 4. 설명 문구는 i18n `{i18nPrefix}.{field}` 키를 먼저 찾고, 없으면 사전의 한국어 description을 쓴다(4개 locale에 같은 키를 추가할 것).
 * 5. db 값은 실제 엔티티(@Column name)와 일치해야 한다 — 추정 금지, 엔티티 파일에서 확인해서 적는다.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import ComCodeSelect, { type ComCodeSelectProps } from "@/components/shared/ComCodeSelect";
import QtyInput, { type QtyInputProps } from "@/components/shared/QtyInput";
import HelpTooltip from "@/components/shared/HelpTooltip";

export interface FieldHelpEntry {
  /** 실제 DB 컬럼 위치 (예: CONSUMABLE_MASTERS.CONSUMABLE_CODE). 파생값이면 "(파생) 근거 테이블" 형태로 적는다 */
  db: string;
  /** 사용자가 이해할 용도 설명 (한국어 기본값, i18n 키가 있으면 그것을 우선) */
  description: string;
}

export type FieldHelpMap = Record<string, FieldHelpEntry>;

export type HeaderHelpAlign = "left" | "center" | "right";

export function createFieldHelp<M extends FieldHelpMap>(helpMap: M, i18nPrefix: string) {
  type K = keyof M & string;

  function useFieldHelp(field: K): FieldHelpEntry {
    const { t } = useTranslation();
    const help = helpMap[field];
    return { db: help.db, description: t(`${i18nPrefix}.${field}`, help.description) };
  }

  /** 라벨 텍스트 옆 ? 아이콘 — 폼 라벨, 섹션 제목 등 어디든 인라인으로 붙일 수 있다 */
  function FieldHelpIcon({ field }: { field: K }) {
    const help = useFieldHelp(field);
    return <HelpTooltip description={help.description} db={help.db} dataField={field} />;
  }

  type FieldBaseProps = {
    field: K;
    label: string;
    required?: boolean;
    className?: string;
    children: ReactNode;
  };

  function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
    return (
      <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
        <FieldHelpIcon field={field} />
      </label>
    );
  }

  function Field({ field, label, required, className = "", children }: FieldBaseProps) {
    return (
      <div className={className}>
        <FieldLabel field={field} label={label} required={required} />
        {children}
      </div>
    );
  }

  type WrapperProps = { field: K; label: string; wrapperClassName?: string };

  function FieldInput({ field, label, required, wrapperClassName, ...props }: Omit<InputProps, "label"> & WrapperProps) {
    return (
      <Field field={field} label={label} required={required} className={wrapperClassName}>
        <Input {...props} required={required} fullWidth />
      </Field>
    );
  }

  function FieldSelect({ field, label, required, wrapperClassName, ...props }: Omit<SelectProps, "label"> & WrapperProps) {
    return (
      <Field field={field} label={label} required={required} className={wrapperClassName}>
        <Select {...props} required={required} fullWidth />
      </Field>
    );
  }

  function FieldComCodeSelect({
    field, label, required, wrapperClassName, ...props
  }: Omit<ComCodeSelectProps, "label"> & WrapperProps) {
    return (
      <Field field={field} label={label} required={required} className={wrapperClassName}>
        <ComCodeSelect {...props} required={required} fullWidth />
      </Field>
    );
  }

  function FieldQtyInput({
    field, label, required, wrapperClassName, ...props
  }: Omit<QtyInputProps, "label"> & WrapperProps) {
    return (
      <Field field={field} label={label} required={required} className={wrapperClassName}>
        <QtyInput {...props} required={required} fullWidth />
      </Field>
    );
  }

  function FieldYnRadio({ field, label, value, onChange }: { field: K; label: string; value: string; onChange: (value: string) => void }) {
    return (
      <Field field={field} label={label}>
        <div className="flex h-10 items-center gap-3">
          {[
            { v: "Y", l: "Y", cls: "text-green-600 dark:text-green-400" },
            { v: "N", l: "N", cls: "text-red-500 dark:text-red-400" },
          ].map((opt) => (
            <label
              key={opt.v}
              className={`flex cursor-pointer items-center gap-1.5 text-xs ${value === opt.v ? `${opt.cls} font-semibold` : "text-text-muted"}`}
            >
              <input type="radio" checked={value === opt.v} onChange={() => onChange(opt.v)} className="h-3.5 w-3.5 accent-primary" />
              {opt.l}
            </label>
          ))}
        </div>
      </Field>
    );
  }

  /**
   * 그리드 컬럼 헤더용: 라벨 + ? 아이콘.
   * 아이콘 클릭이 헤더 정렬 클릭으로 번지지 않도록 stopPropagation 한다.
   */
  function HeaderHelp({ field, label, align = "left" }: { field: K; label: string; align?: HeaderHelpAlign }) {
    const justify = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";
    return (
      <span className={`inline-flex w-full items-center gap-1 ${justify}`}>
        <span>{label}</span>
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <FieldHelpIcon field={field} />
        </span>
      </span>
    );
  }

  /** ColumnDef.header 에 바로 넣는 헬퍼: header: headerWithHelp("consumableCode", t("..."), "center") */
  const headerWithHelp = (field: K, label: string, align?: HeaderHelpAlign) => {
    const Header = () => <HeaderHelp field={field} label={label} align={align} />;
    Header.displayName = `HeaderHelp(${field})`;
    return Header;
  };

  return {
    helpMap,
    useFieldHelp,
    FieldHelpIcon,
    FieldLabel,
    Field,
    FieldInput,
    FieldSelect,
    FieldComCodeSelect,
    FieldQtyInput,
    FieldYnRadio,
    HeaderHelp,
    headerWithHelp,
  };
}
