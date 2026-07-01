/**
 * @file entities/ai-chat-feedback.entity.ts
 * @description AI 채팅 응답 좋아요/싫어요 피드백 — 질문/답변/출처 스냅샷 저장
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'AI_CHAT_FEEDBACKS' })
export class AiChatFeedback {
  @PrimaryGeneratedColumn({ name: 'FEEDBACK_ID' })
  feedbackId: number;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 10 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 10 })
  plant: string;

  @Column({ type: 'varchar2', name: 'ROUTE', length: 200, nullable: true })
  route: string | null;

  @Column({ type: 'varchar2', name: 'MENU_CODE', length: 50, nullable: true })
  menuCode: string | null;

  @Column({ type: 'clob', name: 'QUESTION' })
  question: string;

  @Column({ type: 'clob', name: 'ANSWER' })
  answer: string;

  @Column({ type: 'clob', name: 'SOURCES_JSON', nullable: true })
  sourcesJson: string | null;

  /** LIKE | DISLIKE */
  @Column({ type: 'varchar2', name: 'RATING', length: 10 })
  rating: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50 })
  createdBy: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
