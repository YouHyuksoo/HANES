import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AiPageToolManifest, AiPageToolResult, PAGE_TOOL_PROVIDER, PageToolProvider } from './types';

/**
 * 페이지 도구 디스패처.
 * 등록된 PageToolProvider들을 pageId로 인덱싱해 매니페스트 조회/도구 실행을 위임한다.
 * 페이지/도구가 늘어도 이 클래스는 바뀌지 않는다(Provider만 추가).
 */
@Injectable()
export class AiPageToolsService {
  private readonly providers: Map<string, PageToolProvider>;

  constructor(@Inject(PAGE_TOOL_PROVIDER) providers: PageToolProvider[]) {
    this.providers = new Map(providers.map((p) => [p.pageId, p]));
  }

  getManifest(pageId: string): AiPageToolManifest {
    const provider = this.providers.get(pageId);
    if (!provider) {
      throw new BadRequestException(`지원하지 않는 AI 페이지 도구입니다: ${pageId}`);
    }
    return provider.manifest;
  }

  async executeBackendTool(
    pageId: string,
    toolName: string,
    input: Record<string, unknown>,
    company?: string,
    plant?: string,
  ): Promise<AiPageToolResult> {
    const provider = this.providers.get(pageId);
    if (!provider) throw new BadRequestException(`구현되지 않은 페이지 도구입니다: ${pageId}`);

    const tool = provider.manifest.tools.find((item) => item.name === toolName);
    if (!tool) throw new BadRequestException(`현재 페이지에서 사용할 수 없는 도구입니다: ${toolName}`);
    if (tool.source !== 'backend') throw new BadRequestException(`프론트엔드 전용 도구입니다: ${toolName}`);

    return provider.execute(toolName, input, { company, plant });
  }
}
