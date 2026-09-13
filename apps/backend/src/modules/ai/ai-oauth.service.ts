import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
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
 *   redirect_uri 는 http://localhost:<port>/auth/callback 만 통과한다.
 *              다른 도메인은 첫 홉이 302 라 되는 것처럼 보이지만 끝까지 따라가면 거부된다.
 *
 * 발급된 access_token 의 aud 는 https://api.openai.com/v1 이지만, 이걸 플랫폼 API 키처럼
 * 쓰면 안 된다. 그쪽은 org 의 API 크레딧으로 과금돼 크레딧이 없으면 429 가 난다.
 * ChatGPT 구독으로 호출하려면 chatgpt.com/backend-api 로 나가야 하고, 그때 필요한
 * 계정 ID 는 readChatgptAccountId 가 access_token claims 에서 꺼낸다(2026-09-13 실측).
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
   * 콜백 경로는 고정이다.
   * 실측(2026-09-13): 이 client 는 http://localhost:<포트>/auth/callback 만 받아들인다.
   * 경로가 다르거나 https 외부 도메인이면 로그인 화면에 가기 전에 unknown_error 로 끝난다.
   */
  static readonly CALLBACK_PATH = '/auth/callback';
  /**
   * state 는 충분히 길어야 한다.
   * 16바이트(22자)로는 "The state is missing or does not have enough characters" 를 받는다.
   * 32바이트(43자)는 통과한다.
   */
  private static readonly STATE_BYTES = 32;

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

  /** 진행 중인 루프백 리스너 — 로그인 1회당 하나. 끝나면 닫는다 */
  private listener: http.Server | null = null;

  /**
   * 루프백 콜백 리스너를 띄운다.
   * OpenAI 는 http://localhost:<포트>/auth/callback 로만 code 를 돌려주므로,
   * 브라우저가 도는 바로 그 장비에 리스너가 있어야 한다.
   * 배포 서버처럼 브라우저를 띄울 수 없는 곳은 code 수동 입력(exchangeCode)을 쓴다.
   */
  private async ensureListener(port: number, company: string, plant: string, userId?: string): Promise<void> {
    await this.stopListener();
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname !== AiOauthService.CALLBACK_PATH) {
        res.writeHead(404).end();
        return;
      }
      const reply = (message: string) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px">` +
          `<p>${message}</p><p>이 창을 닫아 주세요.</p>` +
          `<script>setTimeout(()=>window.close(),1500)</script></body>`,
        );
      };
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (error || !code || !state) {
        reply(`연결하지 못했습니다: ${error ?? '값 누락'}`);
        void this.stopListener();
        return;
      }
      this.handleCallback(code, state, company, plant, userId)
        .then((saved) => reply(`OpenAI 계정(${saved.accountEmail ?? '연결됨'})이 연결되었습니다.`))
        .catch((e: unknown) => reply(`연결에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`))
        .finally(() => void this.stopListener());
    });
    await new Promise<void>((resolve, reject) => {
      // 루프백에만 바인딩한다. 외부에서 접근할 수 있으면 안 된다.
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => resolve());
    });
    this.listener = server;
    // 로그인을 끝내지 않고 방치하는 경우가 있으므로 10분 뒤 자동으로 닫는다
    setTimeout(() => void this.stopListener(), 10 * 60 * 1000).unref?.();
  }

  private async stopListener(): Promise<void> {
    const server = this.listener;
    this.listener = null;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** 로그인 시작 — authorize URL 을 만들어 돌려준다 */
  async startWithListener(
    port: number,
    company: string,
    plant: string,
    userId?: string,
  ): Promise<{ authorizeUrl: string; state: string; listening: boolean }> {
    const redirectUri = `http://localhost:${port}${AiOauthService.CALLBACK_PATH}`;
    let listening = false;
    try {
      await this.ensureListener(port, company, plant, userId);
      listening = true;
    } catch (error: unknown) {
      // 리스너를 못 띄우면(포트 점유 등) URL 은 그대로 주고 code 수동 입력으로 넘긴다
      this.logger.warn(`루프백 리스너 기동 실패(${port}): ${error instanceof Error ? error.message : String(error)}`);
    }
    return { ...this.start(redirectUri), listening };
  }

  /** 수동 입력용 — 브라우저 주소창의 code 를 받아 교환한다 (배포 서버처럼 리스너를 못 쓰는 환경) */
  async exchangeCode(code: string, state: string, company: string, plant: string, userId?: string) {
    return this.handleCallback(code, state, company, plant, userId);
  }

  start(redirectUri: string): { authorizeUrl: string; state: string } {
    const verifier = this.base64url(crypto.randomBytes(32));
    const challenge = this.base64url(crypto.createHash('sha256').update(verifier).digest());
    const state = this.base64url(crypto.randomBytes(AiOauthService.STATE_BYTES));

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

  /**
   * access_token claims 에서 ChatGPT 계정 ID 를 꺼낸다.
   *
   * 이 값은 chatgpt.com/backend-api 호출 시 `chatgpt-account-id` 헤더로 넣어야 한다.
   * id_token 의 sub(google-oauth2|...)와는 다른 값이다 — 그걸 넣으면 호출이 계정을 찾지 못한다.
   */
  static readChatgptAccountId(accessClaims: Record<string, unknown>): string | null {
    const auth = accessClaims['https://api.openai.com/auth'];
    if (!auth || typeof auth !== 'object') return null;
    const id = (auth as Record<string, unknown>).chatgpt_account_id;
    return typeof id === 'string' && id ? id : null;
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
      accountId: AiOauthService.readChatgptAccountId(accessClaims),
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
  /**
   * 호출에 필요한 자격 한 묶음. accountId 는 저장 컬럼이 아니라 토큰에서 직접 읽는다
   * (예전 버전이 sub 를 넣어 둔 행이 남아 있어도 올바른 값이 나오게 하려는 것).
   */
  async getCredentials(
    company?: string,
    plant?: string,
  ): Promise<{ accessToken: string; accountId: string | null } | null> {
    const accessToken = await this.getAccessToken(company, plant);
    if (!accessToken) return null;
    return { accessToken, accountId: AiOauthService.readChatgptAccountId(this.decodeJwt(accessToken)) };
  }

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
