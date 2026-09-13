import { tokenizeKnowledgeQuery } from './knowledge-query-tokens';

describe('tokenizeKnowledgeQuery', () => {
  it('소수와 단위를 한 토큰으로 유지한다', () => {
    expect(tokenizeKnowledgeQuery('기밀시험 0.3bar')).toEqual(['기밀시험', '0.3bar']);
    expect(tokenizeKnowledgeQuery('방수커넥터 기밀 0.3 bar')).toEqual(['방수커넥터', '기밀', '0.3', 'bar']);
    expect(tokenizeKnowledgeQuery('DC 3.00kV')).toEqual(['DC', '3.00kV']);
  });

  it('점을 기준으로 0 과 3bar 로 쪼개지 않는다', () => {
    expect(tokenizeKnowledgeQuery('0.3bar')).not.toEqual(['0', '3bar']);
  });
});
