import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { AiOauthToken } from '../../entities/ai-oauth-token.entity';

/**
 * OpenAI OAuth 연결 (Authorization Code + PKCE).
 *
 * 실측으로 확인한 사양 (2026-09-13):
 *   authorize  https://auth.openai.com/oauth/authorize
 *              → 302 로 내부 /api/oauth/oauth2/auth 로 위임한다.
 *              OIDC discovery 가 알려주는 /api/accounts/authorize 는 이 client 로는 400 이다.
 *   token      https://auth.openai.com/api/accounts/oauth/token
 *   client_id  Codex CLI 의 public client. Codex·Hermes 가 같은 값을 쓴다.
 *   필수 파라미터 id_token_add_organizations / codex_cli_simplified_flow 가 없으면
 *              "Invalid authorize request" 400 이 난다.
 *   redirect_uri 는 임의 도메인이 허용된다(배포 서버 콜백 사용 가능).
 *
 * 발급된 access_token 의 aud 가 https://api.openai.com/v1 이라 그대로 Bearer 로 호출한다.
 */
@Injectable()
export class AiOauthService {
  private readonly logger = new Logger(AiOauthService.name);

  static readonly PROVIDER = 'openai-oauth';
  private static readonly AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
  private static readonly TOKEN_URL = 'https://auth.openai.com/api/accounts/oauth/token';
  private static readonly CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
  private static readonly SCOPE =
    'openid profile email offline_access api.connectors.read api.connectors.invoke';
  /** 만료 이 시간 안쪽이면 미리 갱신한다 */
  private static readonly REFRESH_MARGIN_MS = 10 * 60 * 1000;

  /**
   * 진행 중인 로그인 상태. code_verifier 는 수 분짜리 1회용이라 DB 에 두지 않는다.
   * 서버가 재시작되면 진행 중 로그인은 무효가 된다 — 다시 누르면 된다.
   */
  private readonly pending = new Map<string, { verifier: string; redirectUri: string; createdAt: number }>();

  constructor(
    @InjectRepository(AiOauthToken)
    private readonly repo: Repository<AiOauthToken>,
  ) {}

  private base64url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** 로그인 시작 — authorize URL 을 만들어 돌려준다 */
  start(redirectUri: string): { authorizeUrl: string; state: string } {
    const verifier = this.base64url(crypto.randomBytes(32));
    const challenge = this.base64url(crypto.createHash('sha256').update(verifier).digest());
    const state = this.base64url(crypto.randomBytes(16));

    this.prunePending();
    this.pending.set(state, { verifier, redirectUri, createdAt: Date.now() });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: AiOauthService.CLIENT_ID,
      redirect_uri: redirectUri,
      scope: AiOauthService.SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      // 이 둘이 빠지면 authorize 가 "Invalid authorize request" 400 을 낸다
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
    });
    return { authorizeUrl: `${AiOauthService.AUTHORIZE_URL}?${params.toString()}`, state };
  }

  /** 10분 지난 진행중 로그인은 버린다 */
  private prunePending(): void {
    const limit = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of this.pending) {
      if (value.createdAt < limit) this.pending.delete(key);
    }
  }

  /** 콜백 — code 를 토큰으로 교환해 저장한다 */
  async handleCallback(code: string, state: string, company: string, plant: string, userId?: string): Promise<AiOauthToken> {
    const entry = this.pending.get(state);
    if (!entry) {
      throw new BadRequestException('로그인 요청이 만료되었거나 유효하지 않습니다. 다시 연결해 주세요.');
    }
    this.pending.delete(state);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: entry.redirectUri,
      client_id: AiOauthService.CLIENT_ID,
      code_verifier: entry.verifier,
    });
    const tokens = await this.exchange(body);
    return this.save(tokens, company, plant, userId);
  }

  private async exchange(body: URLSearchParams): Promise<Record<string, unknown>> {
    const res = await fetch(AiOauthService.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`토큰 교환 실패 ${res.status}: ${text.slice(0, 300)}`);
      throw new BadRequestException(`OpenAI 토큰 교환에 실패했습니다 (${res.status}).`);
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('OpenAI 토큰 응답을 해석하지 못했습니다.');
    }
  }

  /** JWT payload 를 읽는다(서명 검증은 하지 않는다 — 표시용 정보만 꺼낸다) */
  private decodeJwt(token?: string): Record<string, unknown> {
    if (!token || token.split('.').length !== 3) return {};
    try {
      return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async save(
    tokens: Record<string, unknown>,
    company: string,
    plant: string,
    userId?: string,
  ): Promise<AiOauthToken> {
    const accessToken = String(tokens.access_token ?? '');
    if (!accessToken) throw new BadRequestException('access_token 이 없습니다.');

    const idClaims = this.decodeJwt(String(tokens.id_token ?? ''));
    const accessClaims = this.decodeJwt(accessToken);
    const expSec = Number(accessClaims.exp ?? 0);

    const row = this.repo.create({
      provider: AiOauthService.PROVIDER,
      company,
      plant,
      accessToken,
      refreshToken: tokens.refresh_token ? String(tokens.refresh_token) : null,
      idToken: tokens.id_token ? String(tokens.id_token) : null,
      accountId: (idClaims.sub as string) ?? null,
      accountEmail: (idClaims.email as string) ?? null,
      expiresAt: expSec ? new Date(expSec * 1000) : null,
      lastRefresh: new Date(),
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });
    await this.repo.save(row);
    this.logger.log(`OpenAI OAuth 연결 완료: ${row.accountEmail ?? row.accountId ?? '(계정 미상)'}`);
    return row;
  }

  /** 저장된 연결 상태 (토큰 원문은 반환하지 않는다) */
  async getStatus(company: string, plant: string) {
    const row = await this.repo.findOne({
      where: { provider: AiOauthService.PROVIDER, company, plant },
    });
    if (!row) return { connected: false };
    return {
      connected: true,
      accountEmail: row.accountEmail,
      expiresAt: row.expiresAt,
      lastRefresh: row.lastRefresh,
      expired: row.expiresAt ? row.expiresAt.getTime() <= Date.now() : false,
    };
  }

  async disconnect(company: string, plant: string): Promise<void> {
    await this.repo.delete({ provider: AiOauthService.PROVIDER, company, plant });
  }

  /**
   * 호출에 쓸 access_token 을 돌려준다. 만료가 임박하면 먼저 갱신한다.
   * 연결이 없으면 null — 호출부가 "연결해 주세요"로 안내한다.
   */
  async getAccessToken(company?: string, plant?: string): Promise<string | null> {
    // AiService 는 테넌트 스코프 없이 설정을 읽는다(SysConfig 도 configKey 만으로 조회).
    // 여기서만 회사/사업장을 요구하면 개념이 어긋나므로, 생략 시 해당 provider 의 단일 행을 쓴다.
    const row = await this.repo.findOne({
      where: {
        provider: AiOauthService.PROVIDER,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!row) return null;

    const needsRefresh =
      !row.expiresAt || row.expiresAt.getTime() - Date.now() < AiOauthService.REFRESH_MARGIN_MS;
    if (!needsRefresh) return row.accessToken;

    if (!row.refreshToken) {
      this.logger.warn('access_token 이 만료됐는데 refresh_token 이 없습니다. 재연결이 필요합니다.');
      return null;
    }
    try {
      const tokens = await this.exchange(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: row.refreshToken,
          client_id: AiOauthService.CLIENT_ID,
          scope: AiOauthService.SCOPE,
        }),
      );
      // 갱신 응답에 refresh_token 이 없으면 기존 것을 유지한다(회전하지 않는 경우가 있다)
      if (!tokens.refresh_token) tokens.refresh_token = row.refreshToken;
      if (!tokens.id_token && row.idToken) tokens.id_token = row.idToken;
      const saved = await this.save(tokens, row.company, row.plant, row.updatedBy ?? undefined);
      return saved.accessToken;
    } catch (error: unknown) {
      this.logger.error(`토큰 갱신 실패: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
