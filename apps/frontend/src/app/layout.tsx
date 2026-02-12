/**
 * @file src/app/layout.tsx
 * @description
 * 루트 레이아웃 컴포넌트입니다.
 * 전역 스타일, 폰트, Provider들을 설정합니다.
 *
 * 초보자 가이드:
 * 1. **metadata**: 페이지 메타 정보 (타이틀, 설명 등)
 * 2. **ThemeProvider**: 다크모드 지원을 위한 Provider
 * 3. **i18n**: 다국어 초기화
 */

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "HARNESS MES",
  description: "HARNESS Manufacturing Execution System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Google Fonts - Outfit */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
