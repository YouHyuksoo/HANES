/**
 * @file src/modules/ai-knowledge/markdown-chunker.spec.ts
 * @description 맥락 헤더 주입 시 chunkId 재해시/원본 보존 검증
 */
import { chunkMarkdown, withContextHeader } from './markdown-chunker';

const RAW = `---
menuCode: FG_RECEIVE
audience: user
title: 박스입고
---
## 입고 처리
박스를 스캔해 입고합니다.
`;

describe('withContextHeader', () => {
  it('contextHeader를 설정하고 chunkId를 재해시하되 content는 원본을 유지한다', () => {
    const [chunk] = chunkMarkdown({ sourcePath: 'help/user/ko/FG_RECEIVE.md', docType: 'help', raw: RAW });
    const header = '[박스입고(FG_RECEIVE) 사용자 도움말 | PROD_FLOW 4/4단계 | 선행: 자재투입]';
    const updated = withContextHeader(chunk, header);
    expect(updated.contextHeader).toBe(header);
    expect(updated.content).toBe(chunk.content);
    expect(updated.chunkId).not.toBe(chunk.chunkId);
    expect(updated.chunkId.split(':').slice(0, -1).join(':')).toBe(chunk.chunkId.split(':').slice(0, -1).join(':'));
  });

  it('같은 헤더면 같은 chunkId를 재생성한다 (임베딩 캐시 안정성)', () => {
    const [chunk] = chunkMarkdown({ sourcePath: 'help/user/ko/FG_RECEIVE.md', docType: 'help', raw: RAW });
    const a = withContextHeader(chunk, '[헤더]');
    const b = withContextHeader(chunk, '[헤더]');
    expect(a.chunkId).toBe(b.chunkId);
  });
});
