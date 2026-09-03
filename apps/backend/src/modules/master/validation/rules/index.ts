/**
 * @file src/modules/master/validation/rules/index.ts
 * @description 기준정보 검증 규칙 집계 — 규칙 추가는 도메인 파일에 1건 append
 */
import type { ValidationRule } from './validation-rule.types';
export * from './validation-rule.types';
import { BOM_RULES } from './bom.rules';
import { ROUTING_RULES } from './routing.rules';
import { ITEM_RULES } from './item.rules';
import { QUALITY_MASTER_RULES } from './quality-master.rules';
import { WAREHOUSE_RULES } from './warehouse.rules';
import { BIZ_REVERSE_RULES } from './biz-reverse.rules';

/** 전체 검증 규칙 */
export const ALL_RULES: ValidationRule[] = [
  ...BOM_RULES,
  ...ROUTING_RULES,
  ...ITEM_RULES,
  ...QUALITY_MASTER_RULES,
  ...WAREHOUSE_RULES,
  ...BIZ_REVERSE_RULES,
];
