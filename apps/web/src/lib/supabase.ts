/**
 * @file src/lib/supabase.ts
 * @description
 * Supabase 클라이언트 설정 파일입니다.
 * 브라우저 환경에서 사용할 Supabase 클라이언트를 생성합니다.
 *
 * 초보자 가이드:
 * 1. **환경변수**: NEXT_PUBLIC_ 접두사가 붙은 변수는 클라이언트에서 접근 가능
 * 2. **createClient**: Supabase 클라이언트 인스턴스 생성
 * 3. **싱글톤 패턴**: 한 번 생성된 클라이언트를 재사용
 *
 * 환경변수 설정 (.env.local):
 * ```
 * NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
 * NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 * ```
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase 환경변수가 설정되지 않았습니다. " +
      "NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요."
  );
}

/**
 * Supabase 클라이언트 인스턴스
 * 환경변수가 없으면 빈 문자열로 초기화 (개발 환경용)
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);

/**
 * 서버 컴포넌트용 Supabase 클라이언트 생성 함수
 * 필요시 쿠키 기반 세션 처리를 추가할 수 있습니다.
 */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl || "", supabaseAnonKey || "");
}
