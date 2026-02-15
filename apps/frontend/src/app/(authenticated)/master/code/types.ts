/**
 * @file master/code/types.ts
 * @description 공통코드 관리 페이지 타입 정의
 */

/** 공통코드 그룹 요약 (좌측 패널용) */
export interface ComCodeGroup {
  groupCode: string;
  count: number;
}

/** 공통코드 상세 (우측 그리드용) */
export interface ComCodeDetail {
  id: string;
  groupCode: string;
  detailCode: string;
  parentCode: string | null;
  codeName: string;
  codeDesc: string | null;
  sortOrder: number;
  useYn: string;
  attr1: string | null;
  attr2: string | null;
  attr3: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 공통코드 생성/수정 폼 데이터 */
export interface ComCodeFormData {
  groupCode: string;
  detailCode: string;
  codeName: string;
  codeDesc: string;
  sortOrder: number;
  useYn: string;
  attr1: string;
  attr2: string;
  attr3: string;
}

export const INITIAL_FORM: ComCodeFormData = {
  groupCode: '',
  detailCode: '',
  codeName: '',
  codeDesc: '',
  sortOrder: 1,
  useYn: 'Y',
  attr1: '',
  attr2: '',
  attr3: '',
};
