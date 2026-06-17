import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const file = (path) => join(root, path);
const read = (path) => readFileSync(file(path), "utf8");

const requiredFiles = [
  "apps/print-agent/go.mod",
  "apps/print-agent/README.md",
  "apps/print-agent/cmd/hanes-print-agent/main.go",
  "apps/print-agent/cmd/hanes-print-agent/run_windows.go",
  "apps/print-agent/cmd/hanes-print-agent/run_stub.go",
  "apps/print-agent/internal/config/config.go",
  "apps/print-agent/internal/server/server.go",
  "apps/print-agent/internal/printer/printer.go",
  "apps/print-agent/internal/printer/printer_windows.go",
  "apps/print-agent/internal/printer/printer_stub.go",
  "apps/print-agent/internal/tray/tray_windows.go",
  "apps/print-agent/internal/tray/tray_stub.go",
  "apps/print-agent/internal/jobs/log.go",
  "apps/frontend/src/services/print-agent.ts",
];

for (const path of requiredFiles) {
  assert.ok(existsSync(file(path)), `${path} 파일이 있어야 합니다.`);
}

const server = read("apps/print-agent/internal/server/server.go");
assert.match(server, /127\.0\.0\.1/, "agent는 외부 인터페이스가 아니라 localhost에만 바인딩해야 합니다.");
assert.match(server, /\/health/, "health endpoint가 있어야 합니다.");
assert.match(server, /\/printers/, "printer 목록 endpoint가 있어야 합니다.");
assert.match(server, /\/config/, "config 조회/저장 endpoint가 있어야 합니다.");
assert.match(server, /\/settings/, "agent 자체 설정관리 화면 endpoint가 있어야 합니다.");
assert.match(server, /\/print/, "print endpoint가 있어야 합니다.");
assert.match(server, /\/test-print/, "test-print endpoint가 있어야 합니다.");
assert.match(server, /MaxBytesReader/, "print payload 크기 제한이 있어야 합니다.");
assert.match(server, /Origin/, "browser origin 검증이 있어야 합니다.");
assert.match(server, /handleSettings/, "settings endpoint는 전용 handler로 관리해야 합니다.");
assert.match(server, /restartRequired/, "listenAddress 변경은 재시작 필요 여부로 노출해야 합니다.");
assert.match(server, /clearToken/, "설정 화면에서 token 제거를 명시적으로 처리해야 합니다.");
assert.match(server, /effectiveListenAddress/, "설정 응답에는 현재 실행 중인 listen 주소가 있어야 합니다.");

const printerWindows = read("apps/print-agent/internal/printer/printer_windows.go");
assert.match(printerWindows, /gdi32\.dll/, "Windows 조용한 출력은 GDI printer DC를 사용해야 합니다.");
assert.match(printerWindows, /winspool\.drv/, "Windows 프린터 목록 조회는 winspool을 사용해야 합니다.");
assert.match(printerWindows, /StretchDIBits/, "PNG 비트맵은 printer DC에 직접 그려야 합니다.");
assert.match(printerWindows, /StartDocW/, "출력 작업은 Windows printer document로 시작해야 합니다.");

const main = read("apps/print-agent/cmd/hanes-print-agent/main.go");
assert.match(main, /runAgent/, "main은 플랫폼별 실행 함수로 HTTP 서버와 트레이 실행을 위임해야 합니다.");

const runWindows = read("apps/print-agent/cmd/hanes-print-agent/run_windows.go");
assert.match(runWindows, /http\.Server/, "Windows 실행 경로는 종료 메뉴에서 graceful shutdown 가능한 http.Server를 사용해야 합니다.");
assert.match(runWindows, /tray\.Run/, "Windows 실행 경로는 tray.Run으로 트레이 메뉴를 시작해야 합니다.");
assert.match(runWindows, /backend\.ListPrinters/, "프린터 보기 메뉴는 실제 printer backend 목록을 사용해야 합니다.");
assert.match(runWindows, /SettingsURL/, "Windows tray는 agent 설정관리 화면 URL을 받아야 합니다.");
assert.match(runWindows, /\/settings/, "Windows tray 설정 메뉴는 agent 자체 설정 페이지를 열어야 합니다.");

const trayWindows = read("apps/print-agent/internal/tray/tray_windows.go");
assert.match(trayWindows, /Shell_NotifyIconW/, "트레이 아이콘은 Shell_NotifyIconW로 등록해야 합니다.");
assert.match(trayWindows, /TrackPopupMenu/, "트레이 우클릭 메뉴는 TrackPopupMenu로 표시해야 합니다.");
assert.match(trayWindows, /프린터 보기/, "트레이 메뉴에는 프린터 보기 항목이 있어야 합니다.");
assert.match(trayWindows, /설정/, "트레이 메뉴에는 설정 항목이 있어야 합니다.");
assert.match(trayWindows, /상태 보기/, "트레이 메뉴에는 상태 보기 항목이 있어야 합니다.");
assert.match(trayWindows, /종료/, "트레이 메뉴에는 종료 항목이 있어야 합니다.");
assert.match(trayWindows, /MessageBoxW/, "상태/프린터 보기 결과는 Windows 메시지 박스로 표시해야 합니다.");
assert.match(trayWindows, /ShellExecuteW/, "설정 메뉴는 기본 브라우저로 agent 설정 페이지를 열어야 합니다.");

const config = read("apps/print-agent/internal/config/config.go");
assert.match(config, /AllowedOrigins/, "허용 origin 설정이 있어야 합니다.");
assert.match(config, /Token/, "요청 token 설정이 있어야 합니다.");
assert.match(config, /DefaultPrinter/, "기본 프린터 설정이 있어야 합니다.");

const client = read("apps/frontend/src/services/print-agent.ts");
assert.match(client, /PRINT_AGENT_BASE_URL/, "프론트는 agent base URL을 중앙에서 관리해야 합니다.");
assert.match(client, /checkPrintAgent/, "프론트 health 확인 함수가 있어야 합니다.");
assert.match(client, /getPrintAgentPrinters/, "프론트 프린터 목록 함수가 있어야 합니다.");
assert.match(client, /printAgentPng/, "프론트 PNG 출력 함수가 있어야 합니다.");
assert.match(client, /contentBase64/, "프론트 출력 payload는 이미 렌더링된 PNG base64를 전송해야 합니다.");

console.log("print-agent structure ok");
