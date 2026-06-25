// 소개자료 HTML에 신규 5개 슬라이드를 기존 패턴대로 삽입하고 전체 번호(id/header)를 재정렬한다.
// 멱등성: 이미 신규 슬라이드(data-added="1")가 있으면 중복 삽입하지 않는다.
// 사용: node docs/presentation/scripts/insert-slides.mjs

import fs from 'node:fs/promises';
import path from 'node:path';

const htmlPath = path.join(process.cwd(), 'docs/presentation/hanes-mes-introduction.html');

// 신규 슬라이드 블록. id/번호는 s00 / 00 placeholder → 재정렬 단계에서 일괄 치환된다.
const NEW = {
  AQL: `    <section class="slide" id="s00" data-added="1">
      <div class="canvas soft">
        <header><span class="brand"><span class="mark"></span>HANES MES</span><span>00 / AQL 적용</span></header>
        <main class="split">
          <div class="stack">
            <div>
              <div class="kicker">ACCEPTANCE QUALITY LIMIT</div>
              <h2>AQL 샘플링 적용<br>합부 판정 기준</h2>
              <p class="lead">검사수준 · AQL · 샘플 크기 · Ac/Re 기준 (IQC · 출하검사 공통)</p>
            </div>
            <div class="flow" style="--cols:4">
              <div class="step"><b>로트 크기</b><span>검사 대상 수량</span></div>
              <div class="step"><b>검사수준·AQL</b><span>샘플 문자 · 한계</span></div>
              <div class="step"><b>샘플 추출</b><span>샘플 크기 산정</span></div>
              <div class="step"><b>합부 판정</b><span>Ac · Re 자동 판정</span></div>
            </div>
          </div>
          <div class="screens-2">
            <figure class="screen"><img src="assets/menu-captures/21-quality-qc_aql.png" alt="AQL 관리"><figcaption>AQL 관리 <small>검사수준·한계</small></figcaption></figure>
            <figure class="screen"><img src="assets/menu-captures/22-quality-qc_oqc.png" alt="출하검사"><figcaption>출하검사(OQC) <small>AQL 적용</small></figcaption></figure>
          </div>
        </main>
        <footer><span>AQL 기반 샘플 검사</span><span>IQC·출하검사 합부 기준 일원화</span></footer>
      </div>
    </section>`,

  PROD: `    <section class="slide" id="s00" data-added="1">
      <div class="canvas white">
        <header><span class="brand"><span class="mark"></span>HANES MES</span><span>00 / 생산실적</span></header>
        <main>
          <div class="kicker">SUBPROCESS AND ASSEMBLY</div>
          <h2>생산실적 처리<br>서브공정·조립공정</h2>
          <div class="flow" style="--cols:5">
            <div class="step"><b>서브공정 키팅</b><span>이전 SG 스캔·소비</span></div>
            <div class="step"><b>회로별 SG 발행</b><span>반제품 시리얼 생성</span></div>
            <div class="step"><b>조립 투입</b><span>거울상 2영역 스캔</span></div>
            <div class="step"><b>실적 입력</b><span>양품·불량·자재 차감</span></div>
            <div class="step"><b>실적 집계</b><span>작업지시별 진행</span></div>
          </div>
          <div class="screens-3" style="margin-top:20px">
            <figure class="screen slim"><img src="assets/menu-captures/26-production-prod_kitting.png" alt="서브공정 키팅"><figcaption>서브공정 키팅 <small>SG 스캔·발행</small></figcaption></figure>
            <figure class="screen slim"><img src="assets/menu-captures/27-production-prod_input_assembly.png" alt="조립 투입"><figcaption>조립 투입 <small>2영역 스캔</small></figcaption></figure>
            <figure class="screen slim"><img src="assets/menu-captures/28-production-prod_result.png" alt="생산실적"><figcaption>생산실적 <small>실적 집계</small></figcaption></figure>
          </div>
        </main>
        <footer><span>서브공정 → 조립공정</span><span>반제품 SG 계보 연결</span></footer>
      </div>
    </section>`,

  INSP: `    <section class="slide" id="s00" data-added="1">
      <div class="canvas white">
        <header><span class="brand"><span class="mark"></span>HANES MES</span><span>00 / 검사·출하 이력</span></header>
        <main>
          <div class="kicker">INSPECTION RESULT AND SHIPPING HISTORY</div>
          <h2>검사 결과·출하 이력<br>판정 근거 보존</h2>
          <div class="flow" style="--cols:4">
            <div class="step"><b>검사 결과</b><span>측정값·판정 등록</span></div>
            <div class="step"><b>검사 이력</b><span>작업지시·시리얼별</span></div>
            <div class="step"><b>출하 이력</b><span>박스·고객사·일자</span></div>
            <div class="step"><b>역추적 연결</b><span>제품→검사→LOT</span></div>
          </div>
          <div class="screens-3" style="margin-top:20px">
            <figure class="screen slim"><img src="assets/menu-captures/24-inspection-insp_result.png" alt="검사결과"><figcaption>검사결과 <small>판정 등록</small></figcaption></figure>
            <figure class="screen slim"><img src="assets/menu-captures/25-inspection-insp_history.png" alt="검사이력"><figcaption>검사이력 <small>판정 근거</small></figcaption></figure>
            <figure class="screen slim"><img src="assets/menu-captures/29-shipping-ship_history.png" alt="출하이력"><figcaption>출하이력 <small>출고 이력</small></figcaption></figure>
          </div>
        </main>
        <footer><span>검사 결과와 출하 이력</span><span>판정 근거를 한 흐름에서 보존</span></footer>
      </div>
    </section>`,

  PALLET: `    <section class="slide" id="s00" data-added="1">
      <div class="canvas soft">
        <header><span class="brand"><span class="mark"></span>HANES MES</span><span>00 / 팔레트 구성</span></header>
        <main class="split">
          <div class="stack">
            <div>
              <div class="kicker">PALLET BUILDING</div>
              <h2>팔레트 구성<br>박스 적재·팔레트 출하</h2>
              <p class="lead">박스 스캔 적재 · 팔레트 단위 관리 · 출하지시 연계</p>
            </div>
            <div class="flow" style="--cols:4">
              <div class="step"><b>팔레트 생성</b><span>팔레트 번호 발행</span></div>
              <div class="step"><b>박스 스캔 적재</b><span>박스→팔레트 매핑</span></div>
              <div class="step"><b>팔레트 확정</b><span>적재 수량 확정</span></div>
              <div class="step"><b>팔레트 출하</b><span>출하지시 단위 출고</span></div>
            </div>
          </div>
          <div class="screens-2">
            <figure class="screen"><img src="assets/menu-captures/30-shipping-ship_pallet.png" alt="팔레트 구성"><figcaption>팔레트 구성 <small>박스 적재</small></figcaption></figure>
            <figure class="screen"><img src="assets/menu-captures/31-shipping-ship_pallet_ship.png" alt="팔레트 출하"><figcaption>팔레트 출하 <small>출하지시 연계</small></figcaption></figure>
          </div>
        </main>
        <footer><span>박스 → 팔레트 → 출하</span><span>팔레트 단위 추적</span></footer>
      </div>
    </section>`,

  TRACE: `    <section class="slide" id="s00" data-added="1">
      <div class="canvas white">
        <header><span class="brand"><span class="mark"></span>HANES MES</span><span>00 / 추적성 종합</span></header>
        <main class="split wide-left">
          <figure class="screen"><img src="assets/menu-captures/23-quality-qc_trace.png" alt="추적성 종합조회"><figcaption>추적성 종합조회 <small>제품→반제품→자재 LOT</small></figcaption></figure>
          <div class="stack">
            <div>
              <div class="kicker">INTEGRATED TRACEABILITY</div>
              <h2>추적성 종합 조회<br>제품·반제품·자재 LOT</h2>
              <p class="lead">제품 시리얼 기준 · 반제품 SG 계보 · 원자재 PO/IQC 연결</p>
            </div>
            <div class="flow" style="--cols:2">
              <div class="step"><b>제품 시리얼</b><span>출하 단위 기준</span></div>
              <div class="step"><b>반제품 SG</b><span>서브공정 계보</span></div>
              <div class="step"><b>원자재 LOT</b><span>PO · IQC 연결</span></div>
              <div class="step"><b>검사·불량</b><span>판정 근거</span></div>
            </div>
          </div>
        </main>
        <footer><span>제품 한 건에서 전 구간 추적</span><span>제품 → 반제품 SG → 원자재 LOT</span></footer>
      </div>
    </section>`,
};

// 원본 슬라이드 id 기준 삽입 위치(해당 슬라이드 뒤에 삽입)
const INSERT_AFTER = {
  s08: NEW.AQL,    // IQC 판정 뒤
  s13: NEW.PROD,   // LOT 계보 뒤 → 작업지시(s13) 뒤
  s15: NEW.INSP,   // 공정검사 뒤
  s19: NEW.PALLET, // 포장·출하 뒤
  s20: NEW.TRACE,  // 역추적 뒤
};

function pad2(n) { return String(n).padStart(2, '0'); }

async function main() {
  const full = await fs.readFile(htmlPath, 'utf8');
  if (full.includes('data-added="1"')) {
    console.error('이미 신규 슬라이드가 삽입되어 있습니다. 중복 삽입을 막기 위해 중단합니다.');
    process.exit(1);
  }

  const sectionRe = /    <section class="slide" id="s\d+">[\s\S]*?\n    <\/section>/g;
  const matches = [...full.matchAll(sectionRe)];
  if (matches.length === 0) throw new Error('슬라이드 섹션을 찾지 못했습니다.');

  const head = full.slice(0, matches[0].index);
  const tail = full.slice(matches[matches.length - 1].index + matches[matches.length - 1][0].length);

  // 원본 id를 기준으로 순서대로 재구성하며 신규 블록을 삽입
  const ordered = [];
  for (const m of matches) {
    const block = m[0];
    ordered.push(block);
    const idMatch = block.match(/id="(s\d+)"/);
    const origId = idMatch ? idMatch[1] : null;
    if (origId && INSERT_AFTER[origId]) ordered.push(INSERT_AFTER[origId]);
  }

  // 전체 번호 재정렬: id="sNN", header "<span>NN / "
  const renumbered = ordered.map((block, i) => {
    const num = pad2(i + 1);
    return block
      .replace(/id="s\d+"/, `id="s${num}"`)
      .replace(/<span>\d{1,2} \/ /, `<span>${num} / `);
  });

  await fs.writeFile(htmlPath + '.bak', full, 'utf8');
  const out = head + renumbered.join('\n\n') + tail;
  await fs.writeFile(htmlPath, out, 'utf8');

  console.log(`삽입 완료: 원본 ${matches.length}장 → 총 ${renumbered.length}장 (신규 5장)`);
  console.log(`백업: ${path.relative(process.cwd(), htmlPath)}.bak`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
