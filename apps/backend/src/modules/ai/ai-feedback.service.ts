/**
 * @file src/modules/ai/ai-feedback.service.ts
 * @description AI 채팅 응답 좋아요/싫어요 피드백 저장/삭제
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatFeedback } from '../../entities/ai-chat-feedback.entity';
import { AiChatFeedbackDto } from './dto/ai-chat.dto';

@Injectable()
export class AiFeedbackService {
  constructor(
    @InjectRepository(AiChatFeedback)
    private readonly repository: Repository<AiChatFeedback>,
  ) {}

  async create(
    dto: AiChatFeedbackDto,
    company: string,
    plant: string,
    createdBy: string,
  ): Promise<{ id: number }> {
    const entity = this.repository.create({
      company,
      plant,
      route: dto.route ?? null,
      menuCode: dto.menuCode ?? null,
      question: dto.question,
      answer: dto.answer,
      sourcesJson: dto.sources && dto.sources.length > 0 ? JSON.stringify(dto.sources) : null,
      rating: dto.rating,
      createdBy,
    });
    const saved = await this.repository.save(entity);
    return { id: saved.feedbackId };
  }

  async remove(feedbackId: number, company: string, plant: string): Promise<{ ok: true }> {
    await this.repository.delete({ feedbackId, company, plant });
    return { ok: true };
  }
}
