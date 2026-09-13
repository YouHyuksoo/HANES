/**
 * @file knowledge-query-tokens.ts
 * @description 지식검색 질의 토큰화. 소수(0.3bar, 3.00kV)를 숫자와 단위가 붙은 한 토큰으로 유지한다.
 */
const TOKEN_RE = /[0-9]+(?:\.[0-9]+)?[a-zA-Z가-힣]*|[a-zA-Z가-힣_]+/g;

export function tokenizeKnowledgeQuery(query: string): string[] {
  return query.match(TOKEN_RE) ?? [];
}
