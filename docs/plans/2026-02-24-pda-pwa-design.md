# PDA PWA 설계문서

**날짜**: 2026-02-24
**상태**: 승인됨

## 목표

PDA 페이지(`/pda/*`)를 홈 화면 설치 가능한 독립 앱 경험으로 전환.
온라인 전용, UI 캐싱 + 앱 설치만 지원.

## 기술 선택

`@ducanh2912/next-pwa` — Next.js 15 호환, Workbox 기반 자동 캐싱.

## 구현 범위

### 1. Web App Manifest (`manifest.json`)
- `name`: "HARNESS PDA"
- `short_name`: "PDA"
- `start_url`: `/pda/login`
- `display`: `standalone`
- `theme_color` / `background_color`: 브랜드 컬러
- 아이콘: 192x192, 512x512

### 2. Service Worker (next-pwa 자동 생성)
- 앱 셸 캐싱 (JS/CSS/이미지)
- API 호출은 network-only (온라인 전용)
- 사운드 파일(`/sounds/*`) precache

### 3. PWA 아이콘 세트
- `icon-192x192.png`, `icon-512x512.png`
- Apple Touch Icon

### 4. 메타 태그 (PDA layout)
- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-status-bar-style`

### 5. 설치 프롬프트 UI (선택)
- "홈 화면에 추가" 배너를 PDA 메뉴에 표시

## 영향 받는 파일

| 파일 | 변경 내용 |
|------|----------|
| `next.config.ts` | next-pwa 래핑 추가 |
| `public/manifest.json` | 새로 생성 |
| `public/icons/*` | PWA 아이콘 생성 |
| `src/app/pda/layout.tsx` | 메타태그 추가 |
| `package.json` | `@ducanh2912/next-pwa` 의존성 추가 |

## 제외 사항 (YAGNI)
- 오프라인 데이터 동기화
- 푸시 알림
- 백그라운드 동기화
