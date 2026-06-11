# HANES MES 고객 소개 자료 작업지시서

## 목적

HANES MES를 고객에게 소개하기 위한 가로형 제품 소개 자료를 만든다. 설명서가 아니라 영업/시연용 소개 자료이므로 화면 중심으로 구성하고, 하네스 제조 업종에서 중요한 추적성, 검사 품질, 불량 원인 추적, 출하 이력 관점을 부각한다.

## 최종 산출물

- `docs/presentation/hanes-mes-introduction.pptx`
- `docs/presentation/hanes-mes-introduction.html`
- `docs/presentation/assets/menu-captures/*`
- 필요 시 `docs/presentation/artifact-build-manifest.json`

## 핵심 요구

- 문서는 가로형으로 만든다.
- 장수 제한을 두지 않는다. 화면 흐름과 전달력이 우선이다.
- 글자는 크게 쓰지 말고 화면을 침범하지 않게 한다.
- 한 장에 기준정보 화면 여러 개를 묶어 보여줘도 된다.
- 아이콘은 많이 쓰지 않는다. 화면 캡처와 짧은 문구를 중심으로 한다.
- 문서 작성 방법을 설명하지 말고, 실제 제품 소개 자료를 만든다.
- 현재 메뉴에 있는 화면을 최대한 캡처해서 넣는다.
- 빈 대시보드 느낌보다 실제 메뉴, 실제 업무 흐름, 실제 화면 증거를 우선한다.

## 자료 구성 원칙

1. 첫 화면은 HANES MES가 무엇을 해결하는지 바로 보여준다.
2. 기준정보는 여러 화면을 묶어 "운영 기준을 먼저 표준화한다"는 메시지로 구성한다.
3. 자재는 입하, LOT, 재고, 수불 이력 흐름으로 구성한다.
4. 생산은 현장 키오스크, 작업 진행, LOT 소비/생산 연결을 강조한다.
5. 검사는 검사 결과, 불량 등록, 재검사, 판정 이력을 강조한다.
6. 출하는 박스, 개별 제품, 출하 이력, 역추적 관점으로 구성한다.
7. 마지막은 "제품 -> 공정 -> 검사 -> 자재 LOT" 역추적 메시지로 닫는다.

## 권장 슬라이드 흐름

1. 표지: 하네스 제조 MES를 현재 화면으로 소개
2. 현재 메뉴 커버리지 맵
3. 기준정보 묶음 1: 품목, BOM, 거래처, 설비
4. 기준정보 묶음 2: 공정, 라인, 라우팅, 작업달력, 작업자, 라벨
5. 자재/재고 묶음: 자재 재고, 수불, 실사
6. 자재 입하/LOT: 바코드와 자재 LOT 연결
7. 생산/현장 키오스크: 작업자가 스캔으로 실적 처리
8. 검사/품질: 검사 결과와 판정 이력
9. 불량 조치/재검사: 불량 등록, 조치, 재검증
10. 출하/박스: 박스와 개별 제품 단위 추적
11. 역추적: 제품에서 자재 LOT까지 연결
12. 기준정보 화면 갤러리
13. 자재/재고 화면 갤러리
14. 구현 범위와 고객 가치 요약
15. 시연 흐름 마무리

슬라이드는 15장에 고정하지 않아도 된다. 메뉴 캡처가 더 확보되면 기준정보, 자재, 생산, 검사, 품질, 출하 영역별로 추가한다.

## 캡처 우선순위

1. 실제 고객에게 보여줄 메뉴 화면
2. 기준정보 화면: 품목, BOM, 거래처, 설비, 공정, 라인, 라우팅, 작업달력, 작업자, 창고, 라벨
3. 자재/재고 화면: 자재 입하, 자재 재고, 수불 이력, 실사
4. 생산 화면: 투입, 키오스크, 작업지시, 실적
5. 검사 화면: 검사 결과, 검사 항목, 판정, 재검사
6. 품질 화면: 불량 등록, 불량 조치, 개선 요청
7. 출하 화면: 박스, 출하, 개별 제품 조회

캡처가 빈 데이터로 보이더라도 현재 메뉴 구조와 화면 형태를 보여주는 용도라면 사용할 수 있다. 단, 고객 가치 설명에는 실제 업무 캡처나 안정 캡처를 우선 배치한다.

## 기존 사용 가능 이미지

아래 이미지는 안정적으로 사용할 수 있는 업무 흐름 캡처다.

- `docs/presentation/assets/01-material-receive.png`
- `docs/presentation/assets/02-input-kiosk.png`
- `docs/presentation/assets/03-inspection-result.png`
- `docs/presentation/assets/04-quality-defect.png`
- `docs/presentation/assets/05-shipping-box-stock.png`

현재 메뉴 캡처는 다음 폴더에 둔다.

- `docs/presentation/assets/menu-captures/`

대표 파일 예시는 다음과 같다.

- `01-dashboard-dashboard.png`
- `02-workflow-workflow.png`
- `03-master-mst_part.png`
- `04-master-mst_bom.png`
- `05-master-mst_partner.png`
- `06-master-equip_master.png`
- `15-inventory-inv_mat_stock.png`
- `16-inventory-inv_transaction.png`
- `17-inventory-inv_mat_physical_inv.png`

## 실행 전 확인

1. `C:\Project\HANES`에서 작업한다.
2. `.ai-coordination/` 규칙에 따라 작업 ID와 lock을 먼저 기록한다.
3. 기존 산출물을 덮어쓸 수 있는지 확인한다.
4. 프론트엔드와 백엔드가 실행 가능한지 확인한다.
5. 메뉴 캡처가 필요하면 현재 메뉴 설정 파일을 확인한다.

주요 참고 파일:

- `apps/frontend/src/config/menuConfig.ts`
- `docs/presentation/assets/*`
- `docs/presentation/assets/menu-captures/capture-manifest.json`
- `docs/presentation/assets/menu-captures/usable-captures.json`

## 로컬 실행 기준

프로젝트 상황에 따라 포트가 달라질 수 있으나, 기존 작업 기준은 다음과 같다.

- Frontend: `http://localhost:3002`
- Backend: `http://localhost:3003`

캡처 자동화 시 로그인 또는 API 응답 문제로 화면이 막히면 다음 방식으로 처리한다.

- `/api/health`, `/api/db-info`는 정상 응답이 필요하다.
- 화면 형태 캡처가 목적이면 데이터 API는 빈 배열 또는 빈 객체로 대체할 수 있다.
- `ConnectionCheckOverlay`가 캡처를 막으면 health/db-info 응답을 먼저 안정화한다.
- 캡처 결과가 너무 작은 파일이면 빈 화면일 가능성이 높으므로 발표 자료에는 넣지 않는다.

## 문구 작성 기준

한 슬라이드에는 짧은 제목, 한 줄 설명, 2-4개의 짧은 포인트만 둔다.

좋은 문구 예:

- 자재 LOT부터 완제품 출하까지 이력을 연결합니다.
- 검사 결과와 불량 조치가 같은 흐름 안에 남습니다.
- 기준정보가 표준화되어 라인별 작업과 품질 기준이 흔들리지 않습니다.
- 문제가 발생하면 제품, 공정, 검사, 자재 LOT 순서로 빠르게 역추적합니다.

피해야 할 문구:

- 기능을 길게 설명하는 매뉴얼형 문장
- 구현 방법 중심 설명
- 고객이 보지 않아도 되는 내부 개발 절차
- 화면보다 큰 제목과 긴 본문

## 디자인 기준

- 비율: 16:9 가로형
- 배경: 흰색 또는 짙은 남색 계열을 섞되 한 가지 색만 과하게 쓰지 않는다.
- 화면 캡처는 가능한 크게 배치한다.
- 여러 화면을 묶을 때는 2x2, 3x2 그리드를 사용한다.
- 캡션은 짧게 쓴다.
- 아이콘은 보조 용도로만 쓴다.
- 버튼이나 UI처럼 보이는 장식 요소는 최소화한다.
- 텍스트가 캡처 위를 가리지 않게 한다.

## 검증 기준

완료 전에 최소한 아래를 확인한다.

- PPTX가 열리는지 확인
- HTML이 브라우저에서 열리는지 확인
- 슬라이드 수가 의도한 구성과 맞는지 확인
- 이미지 누락이 없는지 확인
- 텍스트가 박스 밖으로 침범하지 않는지 확인
- 캡처가 너무 흐리거나 빈 화면처럼 보이지 않는지 확인
- 고객에게 보여주는 관점이 기능 목록이 아니라 업무 가치 중심인지 확인

기존 작업에서 확인한 기준 예:

- PPTX: 15장
- PPTX media: 47개
- HTML image refs: 47개
- missing images: 0개
- layout errors: 0개

## 최종 보고 형식

사용자에게는 작업 방법 설명이 아니라 결과 위치와 반영 내용을 먼저 말한다.

예:

```text
만들어놨습니다.

- PPTX: docs/presentation/hanes-mes-introduction.pptx
- HTML: docs/presentation/hanes-mes-introduction.html
- 캡처: docs/presentation/assets/menu-captures/

가로형 고객 소개 자료로 구성했고, 기준정보는 여러 화면을 한 장에 묶었습니다. 자재 입하, 생산 키오스크, 검사, 불량 조치, 출하/박스, 역추적 흐름이 보이도록 화면 중심으로 배치했습니다.
```

## 주의

- 사용자에게 "문서 만드는 법"을 설명하지 않는다.
- 사용자가 원하는 것은 실제 산출물이다.
- 현재 메뉴 캡처를 최대한 넣되, 품질이 낮은 캡처는 갤러리나 부록 수준으로만 사용한다.
- 이전 AI나 사용자가 만든 변경사항을 되돌리지 않는다.
- 커밋은 사용자가 요청할 때만 한다.
