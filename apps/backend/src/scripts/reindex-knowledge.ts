/**
 * @file src/scripts/reindex-knowledge.ts
 * @description AI 지식 인덱스 재생성을 CLI로 실행한다.
 *
 * 왜 필요한가:
 * 재인덱싱은 시스템설정 > AI Embedding 화면에서만 실행할 수 있었다. 그래서 화면에 접근하기 어려운
 * 환경(원격 서버 콘솔 등)에서는 돌릴 수 없고, 실패해도 원인이 화면 밖으로 드러나지 않았다.
 * 이 스크립트는 같은 서비스를 그대로 호출하되 결과와 경고를 콘솔에 남긴다.
 *
 * 사용법:
 *   pnpm --filter @harness/backend exec ts-node -r tsconfig-paths/register src/scripts/reindex-knowledge.ts
 *   (특정 대상만) ... reindex-knowledge.ts docs/standards apps/frontend/public/help/user/ko
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { AiKnowledgeService } from '../modules/ai-knowledge/ai-knowledge.service';
import { EmbeddingService } from '../modules/ai-knowledge/embedding.service';

async function main(): Promise<void> {
  const logger = new Logger('ReindexKnowledge');
  const targets = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const embedding = app.get(EmbeddingService);
    const cfg = await embedding.getConfig();
    logger.log(`임베딩 설정: provider=${cfg.provider} model=${cfg.model} dims=${cfg.dims} real=${cfg.realProvider}`);
    if (!cfg.realProvider) {
      logger.warn('실제 임베딩 제공자가 아닙니다(local-hash). 검색 품질이 낮으니 설정을 확인하세요.');
    }

    const knowledge = app.get(AiKnowledgeService);
    const started = Date.now();
    logger.log(targets.length > 0 ? `대상: ${targets.join(', ')}` : '대상: 기본 전체');

    const result = await knowledge.reindex(targets.length > 0 ? { targets } : {});
    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

    logger.log(`재인덱싱 완료 (${elapsedSec}s)`);
    logger.log(JSON.stringify(result, null, 2));
  } catch (error: unknown) {
    logger.error(`재인덱싱 실패: ${error instanceof Error ? error.message : String(error)}`);
    await app.close();
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

void main();
