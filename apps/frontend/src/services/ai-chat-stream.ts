/**
 * @file services/ai-chat-stream.ts
 * @description AI 채팅 스트리밍 호출 (POST /ai/chat/stream, SSE 수신)
 *
 * 왜 axios 가 아닌가:
 * axios 는 응답을 다 받은 뒤에 넘겨준다. 스트리밍은 "오는 대로" 읽어야 해서 fetch 를 쓴다.
 * 인증/테넌트 헤더는 api.ts 의 resolveAuthHeaders 를 그대로 재사용한다 —
 * 규칙이 두 벌이 되면 한쪽만 고쳐지는 날이 온다.
 *
 * 서버가 보내는 이벤트는 넷이다.
 *   stage : 지금 하는 일(키). 문구가 아니라 키라서 번역은 이쪽에서 한다.
 *   meta  : 출처 목록. 검색이 끝난 시점이라 답변보다 먼저 온다.
 *   delta : 답변 조각. 시나리오 제안처럼 델타가 하나도 없는 응답도 정상이다.
 *   done  : 최종 결과 전체. 화면에 남길 메시지는 항상 이걸로 만든다.
 * 그래서 delta 는 "생성 중 미리보기"로만 쓰고, 확정은 done 이 한다.
 */
import { API_BASE_URL, resolveAuthHeaders } from "./api";

/** 서버가 알리는 진행 단계. 문구는 i18n 키 `ai.chat.stage.*` 로 화면이 정한다. */
export type AiChatStage =
  | "understand"
  | "search"
  | "rerank"
  | "scenario"
  | "tool"
  | "tables"
  | "sql"
  | "query"
  | "answer";

export interface AiChatStreamHandlers {
  onStage?: (stage: AiChatStage) => void;
  onMeta?: (sources: unknown[]) => void;
  onDelta?: (chunk: string) => void;
}

export interface AiChatStreamOptions extends AiChatStreamHandlers {
  signal?: AbortSignal;
}

/**
 * 스트리밍으로 채팅을 요청하고 최종 결과를 돌려준다.
 * 중간 진행은 onMeta/onDelta 로 나가고, 반환값은 /ai/chat 과 같은 모양이다.
 */
export async function streamAiChat<TResult>(
  body: unknown,
  { onStage, onMeta, onDelta, signal }: AiChatStreamOptions = {},
): Promise<TResult> {
  const res = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...resolveAuthHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    // 스트림이 시작되기 전 실패는 평소처럼 JSON 에러 본문이 온다.
    let message = `요청이 실패했습니다 (${res.status}).`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch { /* 본문이 JSON 이 아니면 기본 문구 */ }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: TResult | null = null;
  let streamError: string | null = null;

  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 는 빈 줄로 이벤트를 끊는다. 마지막 조각은 다음 청크와 이어 붙인다.
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let payload: { chunk?: string; sources?: unknown[]; message?: string; stage?: AiChatStage };
      try {
        payload = JSON.parse(data) as typeof payload;
      } catch {
        continue;
      }
      if (event === "delta" && typeof payload.chunk === "string") onDelta?.(payload.chunk);
      else if (event === "stage" && payload.stage) onStage?.(payload.stage);
      else if (event === "meta") onMeta?.(payload.sources ?? []);
      else if (event === "done") done = payload as TResult;
      else if (event === "error") streamError = payload.message ?? "AI 응답 생성에 실패했습니다.";
    }
  }

  if (streamError) throw new Error(streamError);
  // done 없이 스트림이 끝났다면 서버가 중간에 죽은 것이다. 조용히 빈 답을 남기지 않는다.
  if (!done) throw new Error("응답이 중간에 끊겼습니다.");
  return done;
}
