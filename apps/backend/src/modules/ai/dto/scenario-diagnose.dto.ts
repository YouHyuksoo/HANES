/**
 * @file src/modules/ai/dto/scenario-diagnose.dto.ts
 * @description 시나리오 실패 진단 요청
 *
 * events/snapshot 은 화면이 만든 구조를 그대로 받는다. 여기서 스키마를 고정하면
 * 프론트가 증거를 하나 더 담을 때마다 백엔드 DTO 를 같이 고쳐야 한다.
 * 이 값들은 프롬프트 본문으로만 쓰고 저장하지 않으므로 느슨하게 받는다.
 */
import { IsArray, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ArrayMaxSize } from 'class-validator';

export class ScenarioDiagnoseDto {
  @IsString()
  @MaxLength(100)
  scenarioId: string;

  @IsInt()
  @Min(0)
  stepIndex: number;

  @IsString()
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsObject()
  vars?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  events?: unknown[];

  @IsOptional()
  @IsObject()
  snapshot?: Record<string, unknown>;
}
