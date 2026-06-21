"use client";

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HelpTooltip as SharedHelpTooltip } from "@/components/shared";

/**
 * AQL 기준관리 화면의 모든 컬럼(정책 · 기준 · 룰 테이블 헤더)에 대한
 * 도움말 메타데이터. 각 항목은 실제 DB 컬럼 위치(db)와 용도 설명(description)을 가진다.
 *
 * 출처 엔티티:
 *  - IQC_AQL_POLICIES    (IqcAqlPolicy)     : 품목에 적용할 AQL 정책 조합
 *  - AQL_STANDARDS        (AqlStandard)      : AQL 기준 헤더
 *  - AQL_SAMPLING_RULES   (AqlSamplingRule)  : 로트 수량 구간별 샘플링 규칙
 */
export const AQL_FIELD_HELP = {
  policyCode: {
    db: "IQC_AQL_POLICIES.POLICY_CODE",
    description:
      "품목마스터(ITEM_MASTERS.IQC_AQL_POLICY_CODE)가 참조하는 AQL 정책 코드입니다. 품목에는 검사수준·Major AQL·Minor AQL 값을 직접 저장하지 않고, 이 정책 코드만 저장해 검사 기준 조합을 일관되게 적용합니다.",
  },
  policyName: {
    db: "IQC_AQL_POLICIES.POLICY_NAME",
    description:
      "현장에서 정책을 식별하기 위한 표시명입니다. 고객사 기준, 차종/제품군 기준, 검사강도 기준처럼 운영자가 정책의 적용 대상을 이해할 수 있게 작성합니다.",
  },
  policyInspectionLevel: {
    db: "IQC_AQL_POLICIES.INSPECTION_LEVEL",
    description:
      "이 정책에 적용할 검사수준입니다. 품목별 개별 입력값이 아니라 정책 단위 기준이며, Major/Minor AQL 기준과 함께 IQC 샘플링 판정의 기본 조합을 구성합니다.",
  },
  policyMajorAqlCode: {
    db: "IQC_AQL_POLICIES.MAJOR_AQL_CODE",
    description:
      "Major 등급 불량 판정에 사용할 AQL 기준 코드입니다. 선택값은 활성 AQL_STANDARDS.AQL_CODE이며, 해당 기준의 LOT 구간별 sampleSize/Ac/Re 규칙이 Major 판정에 적용됩니다.",
  },
  policyMinorAqlCode: {
    db: "IQC_AQL_POLICIES.MINOR_AQL_CODE",
    description:
      "Minor 등급 불량 판정에 사용할 AQL 기준 코드입니다. 선택값은 활성 AQL_STANDARDS.AQL_CODE이며, Major와 별도로 Minor 불량수에 대한 sampleSize/Ac/Re 규칙을 적용합니다.",
  },
  policyUseYn: {
    db: "IQC_AQL_POLICIES.USE_YN",
    description:
      "AQL 정책의 사용 여부입니다. N이면 신규 품목 연결 선택 목록에서 제외됩니다. 이미 품목에 배정된 정책은 이 화면에서 사용중지할 수 없도록 차단합니다.",
  },
  aqlCode: {
    db: "AQL_STANDARDS.AQL_CODE",
    description:
      "AQL 샘플링 기준 자체를 식별하는 코드입니다. 품목이 직접 참조하는 값이 아니라, AQL 정책(IQC_AQL_POLICIES.MAJOR_AQL_CODE 또는 IQC_AQL_POLICIES.MINOR_AQL_CODE)에서 Major/Minor 판정 기준으로 참조합니다.",
  },
  aqlName: {
    db: "AQL_STANDARDS.AQL_NAME",
    description:
      "AQL 기준의 명칭입니다. 검사원·관리자가 목록에서 기준을 식별할 때 표시되는 이름입니다 (예: 일반검사 AQL 1.0).",
  },
  inspectionLevel: {
    db: "AQL_STANDARDS.INSPECTION_LEVEL",
    description:
      "ISO 2859-1 검사수준입니다. 통상검사수준 I·II·III(II가 표준)과 특별검사수준 S-1~S-4가 있으며, 로트 크기와 함께 시료 코드문자(추출할 샘플 수량)를 결정합니다.",
  },
  aqlValue: {
    db: "AQL_STANDARDS.AQL_VALUE",
    description:
      "합격품질수준(Acceptable Quality Limit) 값입니다. 로트를 합격으로 간주할 수 있는 최대 부적합 비율(%) 또는 100단위당 부적합수를 의미하며, 값이 작을수록 엄격한 기준입니다.",
  },
  useYn: {
    db: "AQL_STANDARDS.USE_YN",
    description:
      "이 AQL 기준의 사용 여부입니다. N이면 AQL 정책의 Major/Minor 기준 선택 목록에서 제외됩니다 (기존 이력은 그대로 유지).",
  },
  remark: {
    db: "AQL_STANDARDS.REMARK",
    description:
      "AQL 기준에 대한 참고 메모입니다. 적용 근거, 고객 요구사항, 개정 이력 등을 자유롭게 기록합니다.",
  },
  lotQtyFrom: {
    db: "AQL_SAMPLING_RULES.LOT_QTY_FROM",
    description:
      "이 샘플링 규칙이 적용되는 로트(검사 단위) 수량 구간의 시작값입니다. 입고·검사 로트 수량이 From~To 범위에 들면 해당 행의 시료수·판정기준이 적용됩니다.",
  },
  lotQtyTo: {
    db: "AQL_SAMPLING_RULES.LOT_QTY_TO",
    description:
      "샘플링 규칙이 적용되는 로트 수량 구간의 종료값입니다. 구간끼리 서로 겹칠 수 없으며, From보다 작을 수 없습니다.",
  },
  sampleSize: {
    db: "AQL_SAMPLING_RULES.SAMPLE_SIZE",
    description:
      "해당 로트 수량 구간에서 무작위로 추출해 검사할 시료(샘플) 개수입니다. ISO 2859-1 샘플 코드문자에 대응합니다.",
  },
  acceptQty: {
    db: "AQL_SAMPLING_RULES.ACCEPT_QTY",
    description:
      "합격판정개수(Ac)입니다. 추출한 시료 중 발견된 부적합 수가 이 값 이하이면 로트를 합격 처리합니다.",
  },
  rejectQty: {
    db: "AQL_SAMPLING_RULES.REJECT_QTY",
    description:
      "불합격판정개수(Re)입니다. 추출한 시료 중 발견된 부적합 수가 이 값 이상이면 로트를 불합격 처리합니다. 항상 Ac보다 커야 합니다 (보통 Ac+1).",
  },
} as const;

export type AqlFieldKey = keyof typeof AQL_FIELD_HELP;

/**
 * AQL 필드 키로 도움말 메타데이터를 조회해 공통 HelpTooltip을 렌더한다.
 */
export function HelpTooltip({ field }: { field: AqlFieldKey }) {
  const { t } = useTranslation();
  const { db, description } = AQL_FIELD_HELP[field];
  return <SharedHelpTooltip description={t(`quality.aql.fieldHelp.${field}`, description)} db={db} dataField={field} />;
}

/**
 * 폼 필드용 라벨 + 도움말. Input/Select의 label prop 대신 외부 라벨로 사용한다.
 */
export function HelpLabel({
  field,
  label,
  required,
}: {
  field: AqlFieldKey;
  label: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip field={field} />
    </label>
  );
}

/**
 * 폼 필드 래퍼: 라벨(+도움말) 위에, 입력 컴포넌트를 아래에 배치한다.
 */
export function HelpField({
  field,
  label,
  required,
  className = "",
  children,
}: {
  field: AqlFieldKey;
  label: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <HelpLabel field={field} label={label} required={required} />
      {children}
    </div>
  );
}

/**
 * 그리드/룰 테이블 헤더용 인라인 도움말: 헤더 텍스트 옆에 ? 아이콘을 붙인다.
 */
export function HelpHeader({ field, label }: { field: AqlFieldKey; label: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <HelpTooltip field={field} />
    </span>
  );
}
