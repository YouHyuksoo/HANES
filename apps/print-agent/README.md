# HANES Print Agent

HANES Print Agent는 작업자 PC에서 실행되는 로컬 출력 브릿지입니다.

웹 화면은 라벨을 PNG로 먼저 렌더링하고, 이 agent의 localhost API로 전송합니다. Agent는 라벨 디자인을 해석하지 않고 Windows 프린터 드라이버에 이미지를 전달합니다.

## 실행

```powershell
cd apps/print-agent
go run ./cmd/hanes-print-agent
```

기본 주소는 `http://127.0.0.1:37111` 입니다.

Windows에서는 실행 후 시스템 트레이에 상주합니다. 트레이 아이콘 우클릭 메뉴는 다음 기능을 제공합니다.

- `상태 보기`: agent 실행 상태와 listen 주소 표시
- `설정`: 기본 브라우저로 agent 자체 설정관리 화면 열기
- `프린터 보기`: 현재 Windows 프린터 목록 표시
- `종료`: HTTP 서버와 tray agent 종료

## API

- `GET /health`
- `GET /printers`
- `GET /config`
- `POST /config`
- `GET /settings`
- `POST /print`
- `POST /test-print`

`POST /print` payload:

```json
{
  "jobId": "LBL2606170001",
  "printerName": "ZDesigner",
  "format": "png",
  "widthMm": 60,
  "heightMm": 40,
  "copies": 1,
  "contentBase64": "..."
}
```

## 설정 파일

설정은 사용자 설정 디렉터리 아래 `HANES/print-agent/config.json`에 저장됩니다.

브라우저에서 `http://127.0.0.1:37111/settings`를 열면 agent가 직접 제공하는 설정관리 화면을 사용할 수 있습니다. 이 화면에서 agent 상태 확인, 프린터 목록 조회, 기본 프린터 저장, 테스트 출력, 허용 Origin, token, 로그 폴더, payload 제한을 관리합니다.

주요 값:

- `listenAddress`: 기본 `127.0.0.1:37111`
- `allowedOrigins`: HANES 웹 origin 허용 목록
- `token`: 설정하면 요청 header `X-HANES-Print-Token` 또는 `Authorization: Bearer ...`로 검증
- `defaultPrinter`: `printerName`이 비어 있을 때 사용할 프린터
- `maxPayloadBytes`: PNG 출력 payload 최대 크기
- `logDir`: 출력 로그 jsonl 저장 폴더

`listenAddress` 변경은 실행 중인 HTTP 서버 포트를 즉시 바꾸지 않습니다. 설정 파일에 저장한 뒤 agent를 재시작해야 적용됩니다. `/config` 응답의 `effectiveListenAddress`는 현재 실행 중인 주소, `restartRequired`는 저장값과 실행값이 달라 재시작이 필요한지 여부입니다.

## 검증

```powershell
node tools/print-agent.structure.test.mjs
cd apps/print-agent
go test ./...
```
