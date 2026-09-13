/**
 * @file entities/ai-oauth-token.entity.ts
 * @description AI provider OAuth 토큰 — 회사/사업장 단위 1건
 *
 * 초보자 가이드:
 * 1. OpenAI 는 API 키 외에 OAuth(Authorization Code + PKCE)로도 붙는다.
 *    다만 이 토큰은 플랫폼 API(api.openai.com)의 API 키 대체물이 아니다.
 *    그쪽으로 보내면 인증은 되지만 org 의 API 크레딧으로 과금돼 크레딧이 없으면 429 가 난다.
 *    ChatGPT 구독을 쓰려면 chatgpt.com/backend-api 로 나가야 하고,
 *    그때 ACCOUNT_ID(=access_token 의 chatgpt_account_id)를 헤더로 같이 보낸다.
 * 2. access_token 은 약 8일, 만료 임박하면 refresh_token 으로 자동 재발급한다.
 * 3. ACCOUNT_ID 는 id_token 의 sub 가 아니다. 둘은 다른 값이고 sub 를 보내면 계정을 못 찾는다.
 * 4. 토큰이 1800자 내외라 CLOB 이다. SYS_CONFIGS 에 넣지 않는 이유이기도 하다
 *    (설정 화면에 값이 그대로 노출된다).
 */
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'AI_OAUTH_TOKENS' })
export class AiOauthToken {
  /** openai-oauth */
  @PrimaryColumn({ name: 'PROVIDER', length: 30 })
  provider: string;

  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'clob', name: 'ACCESS_TOKEN' })
  accessToken: string;

  @Column({ type: 'clob', name: 'REFRESH_TOKEN', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'clob', name: 'ID_TOKEN', nullable: true })
  idToken: string | null;

  @Column({ type: 'varchar2', name: 'ACCOUNT_ID', length: 100, nullable: true })
  accountId: string | null;

  /** 연결된 계정 — 화면에 "누구로 연결됐는지" 보여주려고 둔다 */
  @Column({ type: 'varchar2', name: 'ACCOUNT_EMAIL', length: 255, nullable: true })
  accountEmail: string | null;

  @Column({ type: 'timestamp', name: 'EXPIRES_AT', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', name: 'LAST_REFRESH', nullable: true })
  lastRefresh: Date | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 100, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 100, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
