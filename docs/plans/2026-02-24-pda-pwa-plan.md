# PDA PWA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PDA 페이지(`/pda/*`)를 홈 화면 설치 가능한 PWA로 전환 (온라인 전용)

**Architecture:** `@ducanh2912/next-pwa`로 Service Worker 자동 생성, `manifest.json`으로 앱 메타 정의, PDA layout에 PWA 메타태그 추가. API는 network-only, 정적 자원만 캐싱.

**Tech Stack:** Next.js 15, @ducanh2912/next-pwa, Workbox

---

### Task 1: 의존성 설치 및 .gitignore 업데이트

**Files:**
- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/.gitignore`

**Step 1: @ducanh2912/next-pwa 설치**

Run:
```bash
cd /c/Project/HANES && pnpm add -F @harness/frontend @ducanh2912/next-pwa
```

**Step 2: .gitignore에 SW 빌드 산출물 추가**

`apps/frontend/.gitignore` 끝에 추가:
```
# PWA (next-pwa generated)
public/sw.js
public/sw.js.map
public/workbox-*.js
public/workbox-*.js.map
public/swe-worker-*.js
```

**Step 3: Commit**

```bash
git add apps/frontend/package.json apps/frontend/.gitignore pnpm-lock.yaml
git commit -m "chore: add @ducanh2912/next-pwa dependency"
```

---

### Task 2: PWA 아이콘 생성

**Files:**
- Create: `apps/frontend/public/icons/icon-192x192.png`
- Create: `apps/frontend/public/icons/icon-512x512.png`

**Step 1: SVG 기반 아이콘 생성**

Node.js 스크립트로 간단한 HARNESS PDA 아이콘을 192x192, 512x512 크기로 생성.
브랜드 컬러(#3B82F6 파란색) 배경 + 흰색 "H" 텍스트.

외부 도구 의존 없이 `<canvas>` 또는 SVG→PNG 변환.
별도 도구 불가 시 심플한 SVG를 `public/icons/`에 배치하고 manifest에서 SVG 참조.

**대안:** 단색 PNG placeholder를 직접 생성 (1x1 확대 말고, 실제 아이콘).

**Step 2: Commit**

```bash
git add apps/frontend/public/icons/
git commit -m "feat: add PWA icons for PDA app"
```

---

### Task 3: manifest.json 생성

**Files:**
- Create: `apps/frontend/public/manifest.json`

**Step 1: manifest.json 작성**

```json
{
  "name": "HARNESS PDA",
  "short_name": "PDA",
  "description": "HARNESS MES - PDA Scanner App",
  "start_url": "/pda/login",
  "scope": "/pda/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#3B82F6",
  "background_color": "#F8FAFC",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

핵심 포인트:
- `scope: "/pda/"` — PWA 범위를 PDA 경로만으로 제한
- `start_url: "/pda/login"` — 앱 실행 시 PDA 로그인으로 시작
- `display: "standalone"` — 브라우저 UI 없는 앱 경험
- `orientation: "portrait"` — PDA 세로 고정

**Step 2: Commit**

```bash
git add apps/frontend/public/manifest.json
git commit -m "feat: add PWA manifest for PDA app"
```

---

### Task 4: next.config.ts에 PWA 설정 추가

**Files:**
- Modify: `apps/frontend/next.config.ts`

**Step 1: withPWA 래핑 적용**

```typescript
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  scope: "/pda/",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  workboxOptions: {
    // API 요청은 캐싱하지 않음 (온라인 전용)
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
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
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
```

핵심:
- `disable: process.env.NODE_ENV === "development"` — 개발 시 SW 비활성화
- `scope: "/pda/"` — PDA 경로만 PWA 대상
- API는 `NetworkOnly`, 사운드 파일은 `CacheFirst`

**Step 2: Commit**

```bash
git add apps/frontend/next.config.ts
git commit -m "feat: configure next-pwa for PDA routes"
```

---

### Task 5: PDA layout에 PWA 메타태그 추가

**Files:**
- Modify: `apps/frontend/src/app/pda/layout.tsx`

**Step 1: metadata에 PWA 관련 설정 추가**

```typescript
import type { Metadata, Viewport } from "next";
import PdaAuthGuard from "@/components/pda/PdaAuthGuard";
import PdaLayout from "@/components/pda/PdaLayout";

export const metadata: Metadata = {
  title: "HARNESS PDA",
  description: "HARNESS MES - PDA Scanner App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HARNESS PDA",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3B82F6",
};

export default function PdaRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PdaAuthGuard>
      <PdaLayout>{children}</PdaLayout>
    </PdaAuthGuard>
  );
}
```

핵심:
- `manifest: "/manifest.json"` — PWA manifest 연결
- `appleWebApp` — iOS Safari "홈 화면에 추가" 지원
- `viewport` — Next.js 15 방식으로 별도 export
- `themeColor` — 상단바 색상

**Step 2: Commit**

```bash
git add apps/frontend/src/app/pda/layout.tsx
git commit -m "feat: add PWA meta tags to PDA layout"
```

---

### Task 6: 설치 프롬프트 컴포넌트 (선택)

**Files:**
- Create: `apps/frontend/src/components/pda/PwaInstallPrompt.tsx`
- Modify: `apps/frontend/src/app/pda/menu/page.tsx`
- Modify: `apps/frontend/src/locales/ko.json` (+ en, zh, vi)

**Step 1: PwaInstallPrompt 컴포넌트 작성**

`beforeinstallprompt` 이벤트를 감지하여 "홈 화면에 추가" 배너를 표시.
이미 설치된 경우 (`display-mode: standalone`) 표시하지 않음.

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, X } from "lucide-react";

export default function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 이미 PWA로 실행 중이면 표시 안 함
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // 이전에 닫았으면 24시간 내 재표시 안 함
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    if (result.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <div className="mx-4 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
      <Download className="w-5 h-5 text-blue-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {t("pda.pwa.installTitle")}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
          {t("pda.pwa.installDesc")}
        </p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors"
      >
        {t("pda.pwa.install")}
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 text-blue-400 hover:text-blue-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
```

**Step 2: PDA 메뉴 페이지에 설치 프롬프트 삽입**

`apps/frontend/src/app/pda/menu/page.tsx`의 환영 메시지 아래에 `<PwaInstallPrompt />` 추가.

**Step 3: i18n 키 추가 (ko, en, zh, vi)**

```json
"pda": {
  "pwa": {
    "installTitle": "앱으로 설치하기",
    "installDesc": "홈 화면에 추가하면 더 빠르게 접근할 수 있어요",
    "install": "설치"
  }
}
```

**Step 4: Commit**

```bash
git add apps/frontend/src/components/pda/PwaInstallPrompt.tsx apps/frontend/src/app/pda/menu/page.tsx apps/frontend/src/locales/
git commit -m "feat: add PWA install prompt banner on PDA menu"
```

---

### Task 7: 검증

**Step 1: Production 빌드 후 확인**

```bash
cd /c/Project/HANES && pnpm build --filter=@harness/frontend
```

확인 사항:
- `apps/frontend/public/sw.js` 생성 여부
- `apps/frontend/public/workbox-*.js` 생성 여부

**Step 2: 브라우저 검증 (사용자 수동)**

- Chrome DevTools > Application > Manifest 확인
- Chrome DevTools > Application > Service Workers 확인
- 모바일에서 "홈 화면에 추가" 동작 확인
- 설치 후 standalone 모드 실행 확인
