/**
 * @file src/modules/scheduler/executors/script.executor.ts
 * @description SCRIPT 실행기 - 허용된 로컬 스크립트(.bat/.sh)를 실행하여 작업을 수행한다.
 *
 * 초보자 가이드:
 * 1. execTarget: 스크립트 절대경로 (예: '/opt/scripts/cleanup.sh')
 * 2. execParams(JSON).args: 스크립트에 전달할 인자 배열
 * 3. 보안: SCRIPT_ALLOWED_EXTENSIONS(.bat/.sh)만 허용 + getAllowedScripts() 화이트리스트
 * 4. 심볼릭 링크를 통한 우회 방지: fs.realpathSync으로 실제 경로 확인
 * 5. timeoutSec: 실행 제한 시간 (초과 시 프로세스 강제 종료)
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import {
  SCRIPT_ALLOWED_EXTENSIONS,
  getAllowedScripts,
} from '../config/scheduler-security.config';

const execFileAsync = promisify(execFile);

@Injectable()
export class ScriptExecutor implements IJobExecutor {
  private readonly logger = new Logger(ScriptExecutor.name);

  /**
   * 로컬 스크립트를 실행한다.
   * @param job 스케줄러 작업 엔티티
   * @returns 실행 결과
   */
  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams, timeoutSec } = job;

    // 확장자 검증
    const ext = path.extname(execTarget).toLowerCase();
    if (!SCRIPT_ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ForbiddenException(
        `허용되지 않은 스크립트 확장자입니다: ${ext}. 허용: ${SCRIPT_ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // 파일 존재 확인
    if (!fs.existsSync(execTarget)) {
      throw new BadRequestException(
        `스크립트 파일을 찾을 수 없습니다: ${execTarget}`,
      );
    }

    // 심볼릭 링크 우회 방지 - 실제 경로 확인
    const realPath = fs.realpathSync(execTarget);

    // 허용 스크립트 화이트리스트 검증
    const allowedScripts = getAllowedScripts();
    if (allowedScripts.length > 0 && !allowedScripts.includes(realPath)) {
      throw new ForbiddenException(
        `허용되지 않은 스크립트입니다: ${realPath}. SCHEDULER_ALLOWED_SCRIPTS 환경변수에 등록하세요.`,
      );
    }

    // 인자 파싱
    let args: string[] = [];
    if (execParams) {
      try {
        const parsed = JSON.parse(execParams) as { args?: string[] };
        if (parsed.args && Array.isArray(parsed.args)) {
          args = parsed.args.map(String);
        }
      } catch (error: unknown) {
        throw new BadRequestException(
          `execParams JSON 파싱 실패: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`스크립트 실행: ${realPath} ${args.join(' ')}`);

    try {
      const { stdout, stderr } = await execFileAsync(realPath, args, {
        timeout: (timeoutSec || 300) * 1000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      const output = (stdout || '').trim();
      const errorOutput = (stderr || '').trim();

      if (errorOutput) {
        this.logger.warn(`스크립트 stderr: ${errorOutput.substring(0, 500)}`);
      }

      return {
        success: true,
        message: `스크립트 실행 완료: ${path.basename(realPath)}${output ? ` — ${output.substring(0, 500)}` : ''}`,
      };
    } catch (error: unknown) {
      const err = error as Error & { killed?: boolean; code?: string | number };

      // 타임아웃으로 프로세스 종료된 경우
      if (err.killed) {
        return {
          success: false,
          message: `스크립트 타임아웃 (${timeoutSec}초 초과): ${path.basename(realPath)}`,
        };
      }

      return {
        success: false,
        message: `스크립트 실행 실패: ${err.message}`,
      };
    }
  }
}
