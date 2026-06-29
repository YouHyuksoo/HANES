/**
 * @file packages/shared/src/utils/work-instruction-rules.ts
 * @description 작업지도서 복합키 계약 (프론트 조립 / 백엔드 파싱 단일 출처)
 *
 * 복합키 형식: `itemCode::processCode::revision`
 */

/** 복합키 구분자 */
export const WORK_INSTRUCTION_KEY_SEPARATOR = '::';

/** revision 미지정 시 기본값 */
export const WORK_INSTRUCTION_DEFAULT_REVISION = 'A';

export interface WorkInstructionKeyParts {
  itemCode: string;
  processCode: string;
  revision: string;
}

/** 복합키 문자열 조립. processCode 미지정 시 빈 문자열, revision 미지정 시 'A'. */
export function buildWorkInstructionKey(input: {
  itemCode: string;
  processCode?: string | null;
  revision?: string | null;
}): string {
  return [
    input.itemCode,
    input.processCode || '',
    input.revision || WORK_INSTRUCTION_DEFAULT_REVISION,
  ].join(WORK_INSTRUCTION_KEY_SEPARATOR);
}

/** 복합키 문자열 파싱. 정확히 3개 파트가 아니면 null. */
export function parseWorkInstructionKey(id: string): WorkInstructionKeyParts | null {
  const parts = id.split(WORK_INSTRUCTION_KEY_SEPARATOR);
  if (parts.length === 3) {
    return { itemCode: parts[0], processCode: parts[1], revision: parts[2] };
  }
  return null;
}
