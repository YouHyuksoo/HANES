# AI Embedding 청킹 대상 추가 UI — 파일/폴더 구분

## 배경

`/system/config` → Embedding 탭(`AiEmbeddingPanel.tsx`)의 "청킹 대상 추가" 입력창은 프로젝트 상대경로를 텍스트로 입력하는 단일 `Input` + `추가` 버튼으로 구성되어 있다. 사용자는 이 입력창이 "단일 문서만 추가 가능"하다고 인지하고 있었다.

실제로는 백엔드(`ai-knowledge.service.ts`의 `collectDocuments`/`listMarkdownFiles`)가 대상 경로가 디렉터리이면 하위 `.md` 파일을 재귀적으로 전부 수집해 청킹하므로, 폴더 경로(`docs/standards` 등)를 입력해도 이미 폴더 전체가 처리된다. 문제는 실제 동작이 아니라 **입력창이 파일 전용처럼 보이는 UX**에 있다.

이 설계는 폴더 지원을 명확히 드러내는 UI 개선에 한정한다. 클라이언트 PC의 실제 폴더 업로드(`webkitdirectory`)나 서버 디렉터리 브라우저는 범위 밖이다.

## 변경 범위

`apps/frontend/src/components/system/AiEmbeddingPanel.tsx` 단일 파일만 수정한다. 백엔드 변경 없음(이미 폴더 재귀 처리 지원).

## UI 변경

### 1. 파일/폴더 모드 토글

기존 "청킹 대상 추가" 입력 영역(현재 466~489줄 부근) 위에 세그먼트 토글 두 개 버튼 `파일 | 폴더`를 추가한다.

- 로컬 state: `const [addMode, setAddMode] = useState<"file" | "folder">("file")`
- 기본값 `"file"`로 기존 동작(단일 문서 경로 입력) 인지 유지.
- 선택된 모드 버튼은 `variant="primary"`(또는 활성 스타일), 비선택은 `variant="ghost"`/`secondary`.

### 2. 모드별 placeholder / 버튼 라벨

| 모드 | placeholder | 추가 버튼 라벨 |
|------|-------------|----------------|
| 파일 | `docs/custom/file.md` | 문서 추가 |
| 폴더 | `docs/custom` | 폴더 추가 |

입력 검증 로직(`toChunkTarget`, `normalizeTargetPath`)은 모드와 무관하게 동일하게 동작한다. `addMode`는 UX 안내 목적일 뿐 백엔드로 전달되는 데이터나 검증 조건을 바꾸지 않는다(경로 문자열만 여전히 `targets: string[]`로 전송).

### 3. 폴더 모드 안내 문구

`addMode === "folder"`일 때 입력창 아래 헬프텍스트를 표시한다:

> "폴더 경로를 입력하면 하위 .md 파일을 모두 재귀적으로 청킹합니다."

### 4. 대상 목록 파일/폴더 아이콘

기존 체크박스 대상 목록(490줄~) 각 행에 파일 유형 아이콘을 추가한다.

- 추론 규칙: `target.path.toLowerCase().endsWith(".md")` → 파일(`FileText` 아이콘), 그 외 → 폴더(`Folder` 아이콘).
- `lucide-react`는 이미 이 파일에서 다른 아이콘들을 임포트하고 있으므로 `FileText`, `Folder`를 추가 임포트한다.
- 별도 데이터 스키마 변경 없음 — 경로 문자열만으로 추론하므로 기존 `localStorage`에 저장된 대상 데이터와 그대로 호환된다.

## 데이터 흐름

변경 없음. `handleAddTarget` → `toChunkTarget(newTargetPath)` → `chunkTargets` state 추가 → `handleReindex`가 `selectedTargets.map(t => t.path)`를 `/ai/knowledge/reindex`로 POST. `addMode`는 UI 표시 상태에만 관여하고 이 파이프라인에 값을 전달하지 않는다.

## 에러 처리

변경 없음. 기존 `toChunkTarget`이 `null`을 반환하면(빈 값, `.`, `..` 포함, 절대경로 등) 기존과 동일하게 "프로젝트 상대경로만 입력하세요." 토스트를 띄운다. 폴더/파일 모드에 따른 별도 검증(확장자 강제 등)은 추가하지 않는다 — 사용자가 모드를 잘못 선택해도 실제 백엔드 처리에는 영향이 없기 때문이다.

## 테스트

- 수동 확인(브라우저): `/system/config` → Embedding 탭에서
  1. 파일/폴더 토글 클릭 시 placeholder·버튼 라벨이 바뀌는지
  2. 폴더 모드에서 안내 문구가 표시되는지
  3. 기존 `DEFAULT_CHUNK_TARGETS`(파일 1개 + 폴더 5개)가 목록에서 올바른 아이콘으로 구분되는지
  4. 새 폴더 경로 추가 후 재색인 실행 시 기존과 동일하게 동작하는지(백엔드 변경 없으므로 회귀 없음 확인)
- 자동화 테스트는 이 컴포넌트에 기존 테스트가 없어 추가하지 않는다(기존 패턴 유지).
