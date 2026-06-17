package server

import "net/http"

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(settingsPageHTML))
}

const settingsPageHTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HANES Print Agent 설정</title>
  <style>
    :root { color-scheme: light; font-family: Arial, "Malgun Gothic", sans-serif; color: #172033; background: #f6f7f9; }
    body { margin: 0; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 20px 40px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    .sub { margin: 0 0 20px; color: #667085; font-size: 13px; }
    section { background: #fff; border: 1px solid #d9dee8; border-radius: 8px; padding: 18px; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    label { display: grid; gap: 6px; font-size: 12px; font-weight: 700; color: #344054; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #c8d0dc; border-radius: 6px; padding: 9px 10px; font: inherit; background: #fff; color: #172033; }
    textarea { min-height: 92px; resize: vertical; }
    button { border: 1px solid #172033; border-radius: 6px; padding: 9px 12px; background: #172033; color: #fff; font-weight: 700; cursor: pointer; }
    button.secondary { background: #fff; color: #172033; }
    button:disabled { opacity: .55; cursor: default; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .status { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; background: #eef4ff; color: #175cd3; }
    .warn { background: #fff7e6; border-color: #ffd58a; color: #92400e; }
    .ok { background: #ecfdf3; color: #067647; }
    .muted { color: #667085; font-size: 12px; }
    pre { white-space: pre-wrap; background: #111827; color: #f9fafb; border-radius: 6px; padding: 12px; min-height: 44px; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>HANES Print Agent 설정</h1>
    <p class="sub">이 화면은 PC에 설치된 agent가 직접 제공하는 로컬 설정관리입니다.</p>

    <section>
      <div class="row">
        <span id="health" class="status">상태 확인 중</span>
        <button class="secondary" id="reloadBtn" type="button">새로고침</button>
        <button class="secondary" id="testBtn" type="button">테스트 출력</button>
        <button id="saveBtn" type="button">저장</button>
      </div>
      <p id="restartNotice" class="status warn" style="display:none">listenAddress 변경은 agent 재시작 후 적용됩니다.</p>
    </section>

    <section>
      <div class="grid">
        <label>현재 실행 주소
          <input id="effectiveListenAddress" disabled />
        </label>
        <label>저장할 listenAddress
          <input id="listenAddress" placeholder="127.0.0.1:37111" />
        </label>
        <label>기본 프린터
          <select id="defaultPrinter"></select>
        </label>
        <label>최대 payload bytes
          <input id="maxPayloadBytes" type="number" min="1024" step="1024" />
        </label>
        <label>로그 폴더
          <input id="logDir" />
        </label>
        <label>설정 파일
          <input id="configPath" disabled />
        </label>
      </div>
    </section>

    <section>
      <div class="grid">
        <label>허용 Origin 목록
          <textarea id="allowedOrigins" placeholder="http://localhost:3002&#10;http://127.0.0.1:3002"></textarea>
        </label>
        <label>토큰 설정
          <input id="token" type="password" placeholder="새 토큰 입력 시 변경, 비워두면 기존 토큰 유지" />
          <span class="muted">기존 토큰이 설정된 경우 저장하려면 아래 현재 토큰을 입력해야 합니다.</span>
          <input id="currentToken" type="password" placeholder="현재 토큰" />
          <label class="row" style="display:flex;font-weight:400"><input id="clearToken" type="checkbox" style="width:auto" /> 토큰 제거</label>
        </label>
      </div>
    </section>

    <section>
      <div class="row">
        <span class="muted">결과</span>
      </div>
      <pre id="output">대기 중</pre>
    </section>
  </main>

  <script>
    const $ = (id) => document.getElementById(id);
    let printers = [];
    let config = null;

    function headers() {
      const h = { "Content-Type": "application/json" };
      const token = $("currentToken").value.trim();
      if (token) h["X-HANES-Print-Token"] = token;
      return h;
    }

    function show(value) {
      $("output").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    }

    function splitLines(value) {
      return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    }

    function setPrinterOptions(selected) {
      const select = $("defaultPrinter");
      select.innerHTML = "";
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "프린터 지정 안 함";
      select.appendChild(blank);
      for (const name of printers) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      }
      select.value = selected || "";
    }

    async function load() {
      $("health").textContent = "상태 확인 중";
      const [healthRes, configRes, printersRes] = await Promise.all([
        fetch("/health").then((r) => r.json()),
        fetch("/config").then((r) => r.json()),
        fetch("/printers").then((r) => r.json()),
      ]);
      config = configRes;
      printers = printersRes.printers || [];
      $("health").textContent = healthRes.ok ? "agent 연결됨" : "agent 응답 이상";
      $("health").className = healthRes.ok ? "status ok" : "status warn";
      $("listenAddress").value = config.listenAddress || "";
      $("effectiveListenAddress").value = config.effectiveListenAddress || "";
      $("maxPayloadBytes").value = config.maxPayloadBytes || "";
      $("logDir").value = config.logDir || "";
      $("configPath").value = config.configPath || "";
      $("allowedOrigins").value = (config.allowedOrigins || []).join("\n");
      setPrinterOptions(config.defaultPrinter || "");
      $("restartNotice").style.display = config.restartRequired ? "inline-flex" : "none";
      show({ config, printers });
    }

    async function save() {
      const payload = {
        listenAddress: $("listenAddress").value.trim(),
        allowedOrigins: splitLines($("allowedOrigins").value),
        token: $("token").value.trim(),
        clearToken: $("clearToken").checked,
        defaultPrinter: $("defaultPrinter").value,
        maxPayloadBytes: Number($("maxPayloadBytes").value || 0),
        logDir: $("logDir").value.trim(),
      };
      const res = await fetch("/config", { method: "POST", headers: headers(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "설정 저장 실패");
      $("token").value = "";
      $("clearToken").checked = false;
      show(data);
      await load();
    }

    async function testPrint() {
      const payload = { printerName: $("defaultPrinter").value };
      const res = await fetch("/test-print", { method: "POST", headers: headers(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "테스트 출력 실패");
      show(data);
    }

    $("reloadBtn").addEventListener("click", () => load().catch((err) => show(err.message)));
    $("saveBtn").addEventListener("click", () => save().catch((err) => show(err.message)));
    $("testBtn").addEventListener("click", () => testPrint().catch((err) => show(err.message)));
    load().catch((err) => {
      $("health").textContent = "agent 연결 실패";
      $("health").className = "status warn";
      show(err.message);
    });
  </script>
</body>
</html>`
