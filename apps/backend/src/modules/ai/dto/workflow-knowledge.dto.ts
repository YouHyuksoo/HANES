import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class WorkflowKnowledgeInterpretDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(500)
  query: string;
}
