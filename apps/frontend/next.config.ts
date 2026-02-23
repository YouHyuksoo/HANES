/**
 * @file next.config.ts
 * @description Next.js 설정 - API 프록시, PWA, 패키지 트랜스파일
 *
 * 초보자 가이드:
 * 1. **withPWA**: PDA 페이지를 PWA(Progressive Web App)로 변환
 * 2. **rewrites**: /api 요청을 NestJS 백엔드로 프록시
 * 3. **transpilePackages**: 모노레포 내 패키지 트랜스파일
 * 4. **compiler.removeConsole**: production 빌드 시 console.log 제거
 */
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  scope: "/pda/",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: "NetworkOnly",
        options: {
          cacheName: "api-cache",
        },
      },
      {
        urlPattern: /^https?:\/\/.*\/sounds\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "sound-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@harness/shared"],

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

export default withPWA(nextConfig);
