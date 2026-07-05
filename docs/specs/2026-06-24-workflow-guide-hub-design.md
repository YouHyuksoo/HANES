# 워크플로우 가이드 허브 설계 (`/workflow` 개선)

- 작성일: 2026-06-24
- 대상 화면: `apps/frontend/src/app/(authenticated)/workflow`
- 상태: 설계 확정, 구현 대기

## 1. 배경과 목표

현재 `/workflow`는 React Flow 기반 업무 흐름도 한 장과 노드 클릭 시 우측 상세 패널이
전부다. 흐름을 *보여주기만* 하고, 처음 사용자가 "이 업무를 왜·언제·어떻게 하는지"를
*배우거나* 바로 화면으로 진입하기에는 기능이 부족하다.

목표: `/workflow`를 **처음 사용자를 위한 업무 가이드 + 네비게이션 허브**로 전환한다.

- 흐름도는 전체 맥락을 보여주는 보조 뷰로 유지한다.
- 각 업무 단계마다 "왜/언제/주의점"을 읽는 가이드 본문을 제공한다.
- 그 자리에서 실제 화면 바로가기와 상세 도움말(help md)을 함께 제공한다.

## 2. 핵심 결정 사항 (브레인스토밍 합의)

| 항목 | 결정 |
| --- | --- |
| 페이지 핵심 역할 | 가이드 + 네비게이션 허브 통합 |
| 가이드 콘텐츠 소스 | 워크플로우 전용 짧은 서술(신규) + 기존 help md 연결(재사용) 결합 |
| 메인 레이아웃 | 좌측 단계 목록 + 중앙 가이드 본문 + 상단 [가이드]/[흐름도] 탭 |
| 다국어 | 한국어 본문 우선, UI 라벨만 4개 언어, 본문은 i18n 교체 가능하도록 구조 분리 |
| 흐름도 탭 | 현재 React Flow 맵을 그대로 유지(회귀 위험 최소) |
| v1 작성 범위 | 주 흐름(구매·입하 → 자재·IQC → 생산 → 품질 → 출하) 우선, 추적·역처리는 골격만 |

## 3. 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ 헤더: 제목 + 전역 검색           [가이드] [흐름도] 탭  │
├──────────┬──────────────────────────────────────────┤
│ 레인 그룹  │  ▸ 가이드 탭 (중앙 본문)                  │
│ (아코디언) │   단계 제목 + 레인 배지 + 진행번호         │
│ · 구매·입하 │   ── 왜 하는가 / 언제 / 주의점 (신규)     │
│ · 자재·IQC │   ── 입력 · 산출 (기존)                   │
│ ▾ 생산     │   ── 화면 바로가기 (기존 routes)          │
│   1 작업지시│   ── 관련 화면 도움말 (help md 인라인)     │
│  ▶2 키오스크│   ── 선행/후행 단계 이동                  │
│   3 실적   │                                          │
│ · 품질     │  ▸ 흐름도 탭: 현재 React Flow 맵 재사용    │
│ · 출하     │    (노드 클릭 → 같은 단계 가이드로 점프)   │
└──────────┴──────────────────────────────────────────┘
```

- 좌측 레인 그룹이 자연스러운 "역할별 묶음" 역할을 한다(자재담당은 자재·IQC 그룹만 보면 됨).
- [가이드]/[흐름도] 탭은 같은 `selectedNodeId` 상태를 공유한다. 흐름도 탭에서 노드를
  클릭하면 가이드 탭이 해당 단계를 띄운다.
- 전역 검색은 좌측 단계 목록을 필터링한다(기존 검색 로직 재사용 가능).

## 4. 데이터 모델 변경 (`config/workflowMap.ts`)

`WorkflowActivityNode`에 가이드용 **선택(optional)** 필드를 추가한다. 기존 필드는 그대로 둔다.

```ts
export interface WorkflowActivityNode {
  // ... 기존 필드 유지 ...
  why?: string;        // 이 업무를 왜 하는가 (1~2문장)
  when?: string;       // 선행조건 / 언제 수행하나
  cautions?: string[]; // 자주 하는 실수 · 주의점
  order?: number;      // 좌측 목록 진행번호 (레인 내 순서)
  helpRefs?: { menuCode: string; audience: "user" | "operator" }[];
}
```

- `helpRefs`를 명시하지 않으면 `routes[].path` → `findMenuCodeByPath()`로 메뉴코드를
  자동 도출한다. manifest에 존재하는 메뉴코드만 노출한다. 즉 **추가 데이터 입력 없이도
  동작**하고, 필요한 단계만 `helpRefs`로 override 한다.
- `order` 미지정 시 기존 `x` 좌표 순서를 fallback 정렬 키로 사용한다.

## 5. help 마크다운 인라인 재사용

기존 자산을 그대로 재사용한다.

- `useHelpDoc(menuCode, tab)` (`hooks/useHelpDoc.ts`): 도움말 본문/loading/notFound 반환
- `MarkdownRenderer` (`components/help/MarkdownRenderer.tsx`): 마크다운 렌더
- `findMenuCodeByPath(path)` (`config/menuConfig`): route 경로 → 메뉴코드 역추적
- `useHelpManifest` / `lib/help.ts`: manifest 조회 및 존재 여부 확인

가이드 본문 하단 "관련 화면 도움말" 섹션에서 해당 단계의 메뉴코드별 도움말을 **접힌
아코디언**으로 인라인 렌더한다. 클릭 시 펼쳐 `MarkdownRenderer`로 표시하고, 도움말이
없으면(notFound) 항목 자체를 숨긴다. 별도 패널 이동 없이 한 화면에서 완결한다.

## 6. 컴포넌트 구성

| 파일 | 책임 |
| --- | --- |
| `workflow/page.tsx` | 탭/선택상태/검색 상태 컨테이너, 레이아웃 셸 |
| `workflow/components/WorkflowSidebar.tsx` | 레인 그룹 아코디언 + 단계 목록 + 검색 필터 |
| `workflow/components/WorkflowGuide.tsx` | 중앙 가이드 본문(왜/언제/주의점/입력·산출/바로가기/선후행) |
| `workflow/components/WorkflowHelpInline.tsx` | help md 인라인 아코디언 |
| `workflow/components/WorkflowFlow.tsx` | 현재 `page.tsx`의 React Flow 맵 로직을 분리·이동 |

- 기존 `WorkflowBranch.tsx` / `WorkflowPopover.tsx` / `WorkflowNode.tsx` / `WorkflowCard.tsx`는
  현 사용 여부를 구현 단계에서 확인하고, 흐름도 탭에서 계속 쓰는 것만 유지한다.
- 흐름도 탭(`WorkflowFlow.tsx`)은 현재 `page.tsx`의 React Flow 동작을 그대로 옮긴다.
  로직 변경 없이 노드 클릭 시 `selectedNodeId`만 상위로 올린다.

## 7. i18n & 범위

- **UI 라벨**(탭 제목, 섹션 제목, 버튼)만 `ko/en/zh/vi` 4개 파일에 키 추가. JSON BOM 금지.
- **가이드 본문**(why/when/cautions)은 `workflowMap.ts`에 한국어로 작성. 기존 노드
  텍스트가 한국어 하드코딩인 패턴과 동일하게 둔다. 본문을 노드 데이터로 분리 유지하여
  추후 i18n 키 교체가 쉽도록 한다.
- **v1 본문 작성 범위**: 주 흐름(구매·입하 → 자재·IQC → 생산 → 품질 → 출하) 핵심
  단계의 why/when/cautions를 우선 채운다. 추적·역처리 레인은 골격(필드 비움 허용)만.

## 8. 비목표 (YAGNI)

- 역할/페르소나 선택 랜딩, 학습 진도 저장(읽음 체크), 퀴즈 등은 v1 범위 아님.
- 가이드 본문의 다국어 번역은 v1 범위 아님.
- 흐름도 시각화 자체의 재설계는 하지 않는다(현행 유지).

## 9. 검증

- `pnpm --filter @harness/frontend exec tsc --noEmit` 타입 0 에러.
- 가이드 탭/흐름도 탭 전환, 좌측 단계 선택 → 중앙 본문 갱신, 화면 바로가기 동작 확인.
- help 인라인: 메뉴코드 자동 도출이 manifest에 존재하는 단계는 도움말 노출, 없는 단계는
  섹션 자체가 숨겨지는지 확인.
- 흐름도 탭이 기존과 동일하게 렌더되는지(회귀) 확인.
- i18n 4파일 키 동기화는 Grep으로 누락 점검.
