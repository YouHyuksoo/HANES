/**
 * @file next.config.ts
 * @description Next.js 설정 - API 프록시, 패키지 트랜스파일
 *
 * 초보자 가이드:
 * 1. **rewrites**: /api 요청을 NestJS 백엔드로 프록시
 * 2. **transpilePackages**: 모노레포 내 패키지 트랜스파일
 * 3. **compiler.removeConsole**: production 빌드 시 console.log 제거
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@harness/shared"],

  // production 빌드 시 console.log 제거
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
