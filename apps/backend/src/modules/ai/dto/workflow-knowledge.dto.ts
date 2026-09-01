import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class WorkflowKnowledgeInterpretDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query: string;
}
