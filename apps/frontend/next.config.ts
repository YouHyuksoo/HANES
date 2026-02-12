/**
 * @file next.config.ts
 * @description Next.js 설정 - API 프록시, 패키지 트랜스파일
 *
 * 초보자 가이드:
 * 1. **rewrites**: /api 요청을 NestJS 백엔드로 프록시
 * 2. **transpilePackages**: 모노레포 내부 패키지 트랜스파일
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hanes/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
