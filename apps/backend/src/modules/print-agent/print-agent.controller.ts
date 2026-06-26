/**
 * @file src/modules/print-agent/print-agent.controller.ts
 * @description HANES Print Agent(작업자 PC 로컬 출력 브릿지) 실행파일 배포 엔드포인트.
 *
 * 라벨 출력 화면에서 agent 미연결이 감지되면 안내 모달의 [다운로드] 버튼이 이 경로를 연다.
 * 브라우저는 다운로드만 가능하고 자동 실행은 불가하므로, 사용자가 받은 exe를 1회 직접 실행하면
 * 트레이에 상주하며 127.0.0.1:37111 API가 열린다.
 *
 * - GET /print-agent/info     : 배포 가능 여부 + 파일명 + 크기 (모달에서 버튼 활성화 판단)
 * - GET /print-agent/download : exe 바이너리 스트리밍 (Content-Disposition: attachment)
 *
 * @Public: 미연결 상태에서도 받을 수 있어야 하고 exe는 공개 클라이언트 배포물이므로 인증 제외.
 * @Res 직접 사용: 전역 TransformInterceptor가 바이너리를 JSON으로 래핑하지 못하도록 우회.
 */
import {
  Controller,
  Get,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { Public } from '../../common/decorators/public.decorator';

const BINARY_FILENAME = 'hanes-print-agent.exe';

/**
 * 환경마다 실행 위치(cwd)가 달라질 수 있어 후보 경로를 순서대로 탐색한다.
 * 배포 환경에서는 PRINT_AGENT_BINARY_PATH 환경변수로 명시하는 것을 우선한다.
 */
function resolveBinaryPath(): string | null {
  const candidates = [
    process.env.PRINT_AGENT_BINARY_PATH,
    join(process.cwd(), '..', 'print-agent', 'dist', BINARY_FILENAME),
    join(process.cwd(), 'apps', 'print-agent', 'dist', BINARY_FILENAME),
    join(__dirname, '..', '..', '..', '..', 'print-agent', 'dist', BINARY_FILENAME),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

@Public()
@Controller('print-agent')
export class PrintAgentController {
  private readonly logger = new Logger(PrintAgentController.name);

  /** 배포 가능 여부 + 메타데이터 (다운로드 버튼 활성화/크기 표시용) */
  @Get('info')
  info(): { available: boolean; fileName: string; sizeBytes: number | null } {
    const binaryPath = resolveBinaryPath();
    return {
      available: Boolean(binaryPath),
      fileName: BINARY_FILENAME,
      sizeBytes: binaryPath ? statSync(binaryPath).size : null,
    };
  }

  /** exe 바이너리 다운로드 */
  @Get('download')
  download(@Res() res: Response): void {
    const binaryPath = resolveBinaryPath();
    if (!binaryPath) {
      this.logger.error(
        `Print Agent 실행파일을 찾지 못했습니다. PRINT_AGENT_BINARY_PATH 또는 apps/print-agent/dist/${BINARY_FILENAME} 배포 여부를 확인하세요.`,
      );
      throw new NotFoundException(
        'Print Agent 설치 파일을 찾을 수 없습니다. 관리자에게 문의하세요.',
      );
    }

    res.download(binaryPath, BINARY_FILENAME, (error: Error | null) => {
      if (error && !res.headersSent) {
        this.logger.error(`Print Agent 다운로드 실패: ${error.message}`);
      }
    });
  }
}
