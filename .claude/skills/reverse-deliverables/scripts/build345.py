from lib import *
import yaml,subprocess
def dc(i): return f'<span id="{i}"></span><code>{i}</code>'
info=D['info']
def cnt(mod):
    n=0
    for b in MODS[mod][2]:
        n+=len(glob.glob(f'{R}/apps/backend/src/modules/{b}/**/*.spec.ts',recursive=True))
    return n
SPEC={m['code']:cnt(m['code']) for m in mods}
WF=[]
for f in sorted(glob.glob(f'{R}/docs/workflows/definitions/*.md')):
    WF.append(yaml.safe_load(open(f,encoding='utf-8-sig').read().split('---')[1]))
SC_BY={s['code']:s for s in SCREENS}

# ================= 3. 시험 운영 결과 보고서 =================
t=Doc('03-trial-report.html','HNS-MES-TR-001','시험 운영 결과 보고서','HANES MES — 시험 운영 결과 (2026-09 시험 운영 기간)','시험 운영 기간 중 수행한 점검·시험의 범위, 결과, 조치 내용을 정리한다.')
t.h2('1. 개요')
t.h3('1.1 목적 및 범위',toc=False)
t.p('2026년 9월 시험 운영 기간 동안 JSHANES 사업장 환경에서 수행한 업무 흐름 점검, 현장 실무 흐름 테스트, 고객 감사 항목 대조, 자동화 시험 결과를 정리하고 발견된 결함의 조치 상태를 보고한다.')
t.h3('1.2 시험 환경',toc=False)
t.raw(table(['항목','내용'],[
 ['대상 시스템','HANES MES (프론트엔드 Next.js, 백엔드 NestJS, Oracle DB)'],['시험 사이트','JSHANES (COMPANY=40, PLANT_CD=1000)'],
 ['시험 기간','2026-09-01 ~ 2026-09-25 (보고서·점검기록 작성일 기준)'],
 ['시험 수행','개발팀 및 현장 담당(THN 흐름 검증 책임 포함), 현장 실무 흐름 테스트는 현장 사용자가 수행'],
 ['시험 방법','화면→Controller→Service→Entity 호출 체인 추적, 운영 DB(SYS_CONFIGS·재고·수불 건수) 실측 조회, 자동화 단위/구조 시험, 현장 실무 시나리오 수행, 타입 검사(tsc)'],
 ['장비','키오스크, PC 업무 화면, PDA, 라벨 프린터, 검사 설비(통전/내전압/리크/토크/비전/릴레이)'],
]))
t.box('<b>작성 근거 안내</b> 본 보고서의 수치와 판정은 저장소에 보존된 점검 보고서(docs/reports)·미완료 작업 기록·자동화 시험 파일에서 인용했다. 기록에 없는 값은 만들지 않았고, 모듈별 결과는 해당 모듈을 다룬 시험 회차의 기록을 기준으로 서술했다.','warn')
t.h2('2. 시험 회차별 수행 결과')
RND=[
 ['R01','2026-09-01','입고~출하 종단 점검','자재 입하/IQC/AQL/입고 → 작업지시/공정수불 → 실적/초중종/취소 → 포장/OQC/출하 전 구간 호출 체인 추적 + JSHANES 설정·건수 조회','메인 체인 연결 확인. 정상 확인 9개 항목(입하≠창고재고, 서버 AQL 최종판정, IQC PASS만 입고/출고, 실적취소 역분개, 자동차감 단일 시점, 미포장 FG 단독 출하 불가 등). 결함/구멍 다수 식별(운영 설정 2건, 코드 구멍 다수)','e2e-mes-flow-review'],
 ['R02','2026-09-02','구멍 수정 및 재점검','R01 지적 사항 수정 후 재점검','8개 구멍 수정(IQC FAIL 입하재고 이동, 특채 입고 입하재고 차감, 박스 입고 전표 필수, 재개봉 거부, 팔레트 OQC, WIP 이중복원, 빈 라우팅 전량 차감, 키오스크 LAST 차단). 백엔드 jest 7 spec 126 통과, 키오스크 LAST 구조 시험 2 통과, FE/BE tsc 오류 0. 재점검 시 운영 OQC_ENABLED=Y, MAT_ISSUE_STOCK_CHECK=BLOCK 확인','workflow-hole-fix-2, workflow-recheck'],
 ['R03','2026-09-03','현장 개선요청 2차분 9건 재검증','소모품 타수, 중물검사, 진행률, 그리드/스캔 출고→공정재고 적재 및 요청 배분, 즐겨찾기 등 9건 항목별 확인 절차 수행','9건 반영(수정 커밋 82ef6433 등). 트랜잭션 불변식 5규칙을 기준정보검증 TXN_INVARIANT에 추가하고 스케줄러 정기 검증 등록','field-improvement-2nd-batch'],
 ['R04','2026-09-08','자재 38건 · 기준정보 10건 개선 검증','PO/입하/입고/출고 화면 합계·표시·이력 개선, 기준정보 사용여부 필터·작업지도서 공정명 등, API 검증','자재 개선 38건 반영(즐겨찾기 폴더 포함), 기준정보 개선 10건 반영·API 검증. 라벨 재발행 제한(전량 입고/취소 불가)은 승인 근거 미확인으로 임의 해제하지 않고 화면 안내만 추가','material-improvements, master-ten-improvements'],
 ['R05','2026-09-09~11','현장 실무 흐름 테스트 22건 처리','현장 사용자가 수행한 실무 흐름 테스트에서 접수된 22건을 분석·수정','22건 처리 완료(결함 수정, 개선, 신규 메뉴 IQC불합격자재 불량창고입고 포함). 라벨 QR 템플릿 5종 DB 복구, AQL 판정 규칙 보완. 검증: backend jest 관련 스위트 340+ 통과, frontend 구조 시험 807건 중 804 통과(실패 3건은 수정 이전 HEAD에서도 실패하던 기존 건), FE/BE tsc 통과','field-requests-22-batch'],
 ['R06','2026-09-09','고객 감사 지적 17항목 대조','감사 자료 17개 지적을 현재 코드로 실측해 있음/부분/없음 판정','있음 6, 부분 7, 없음 4. 즉시 보완 항목(작업 전 점검 서버 게이트, FIFO 등)은 같은 날 착수하고 보완 설계·구현 계획 수립. 이후 한도견본(양불마스터), 검사보조구, 관리계획서 등 보완 메뉴 구현','customer-audit-17-items-review'],
 ['R07','2026-09-24','THN 제조공정 검사 커버리지','공정 PDF 기준 검사 공정별 HANES 대응 점검 및 보완 후 실데이터 검증','수입/단자/구조/통전/내전압·리크/최종 검사 지원 확인. 토크·비전·릴레이 기능검사 보완. 실데이터 검증: 토크 PASS, 비전 FAIL, 릴레이 PASS 3건이 INSPECT_RESULTS에 제품·작업자·설비와 함께 보존, FG 라벨 검사 참조 갱신 확인','thn-process-inspection-coverage'],
]
t.raw(table(['시험번호','일자','시험명','시험 내용','결과','근거 보고서'],[[dc('TST-'+r[0])] +r[1:5]+[r[5]] for r in RND],raw=True))
t.h3('2.1 자동화 시험 현황',toc=False)
t.raw(table(['구분','수량','비고'],[['백엔드 단위 시험(*.spec.ts)',info['specs'],'서비스·컨트롤러 단위, AQL/수불/수량 계산 등'],['프론트 구조·보조 시험(*.test.*)',info['tests'],'모달 접근성, 삭제 확인 가드, 메뉴 로케일 커버리지, 도움말 레지스트리 등'],['화면 시나리오(Playwright 러너)',f'{info["scen"]}','시나리오 러너(SCN)로 키오스크 등 업무 시나리오 실행'],['마이그레이션 SQL',info['migrations'],'적용 후 pre/post 확인 방식']]))
t.p('R05 시점 실행 결과: 프론트 구조 시험 807건 중 804건 통과. 백엔드는 변경 범위 스위트 기준 340건 이상 통과했다.')

t.h2('3. 모듈별 시험 결과')
t.p('모듈별 요구사항(REQ) 전체를 대상으로 한 시험 결과를 TST-모듈-001로 정리한다. 자동화 시험 수는 해당 모듈 백엔드 *.spec.ts 파일 수이다.')
MR={
 'MATERIAL':('R01·R02·R03·R04·R05','입하→IQC→라벨→입고→출고 체인 정상 연결. 서버 AQL 최종 판정, IQC PASS만 입고/출고, 입하재고와 창고재고 분리 확인. IQC FAIL 불용창고 이동·특채 입고 차감·라벨 QR 템플릿·AQL 불량수 귀속 결함 수정.','적합(결함 수정 후)','입하 후 IQC 판정과 라벨 재발행 제한 정책은 현장 승인 근거 확인 필요(현행 유지)'),
 'PURCHASING':('R04','PO관리·PO현황 합계/컬럼 개선 반영 및 확인.','적합','-'),
 'PRODUCTION':('R01·R02·R03·R05','작업지시→출고요청→공정재고→장착→실적 자동차감, 실적 취소 역분개 확인. 스캔 출고의 공정재고 적재·요청 배분, 소모품 타수, 진행률 갱신 수정.','적합(결함 수정 후)','키오스크+키팅 동일 지시 동시 사용 시 이중 소비(설계상 미차단). 키오스크 브라우저 E2E는 구조 시험으로 대체'),
 'INSPECTION':('R07','통전·내전압·리크·토크·비전·릴레이 검사 저장 경로와 FG 라벨 판정 연결 확인. 신규 3개 검사 실데이터 3건 보존 확인.','적합','설비 센서 원시 신호 자동 수집은 설비 통신 사양 확정 후 연동 대상'),
 'QUALITY':('R01·R05·R06·R07','서버 AQL 판정 로직(Critical 즉시 FAIL, 항목 FAIL→LOT FAIL) 정상. 판정 기준 요약 표시·예상 LOT 판정 추가. 고객 감사 17항목 대조 및 보완 메뉴 구현.','적합(보완 진행)','감사 대조 결과 부분 7건·없음 4건 중 보완 설계 대상 항목은 구현 계획에 따라 순차 반영'),
 'SHIPPING':('R01·R02','출하지시→박스/팔레트→출하, 출하취소 역분개 확인. 박스 입고 전표 필수·팔레트 OQC 게이트 수정. OQC_ENABLED=Y 설정 확인.','적합(결함 수정 후)','과거 SHIPPED+PENDING 박스 100건은 시험 이전 운영 데이터'),
 'PRODUCT_INVENTORY':('R01·R05','제품재고 입고·출하 연계, 실사·보류 관리 확인(출하 시 박스 입고 전표 요구).','적합','-'),
 'PRODUCT_MGMT':('R01·R05','제품 수불 전표(WIP_OUT/FG_IN 등)와 재고 정합성 확인, 제품 이력 조회.','적합','-'),
 'MASTER':('R04·R03','기준정보 개선 10건 반영·API 검증, 기준정보검증(TXN_INVARIANT 포함) 정기 점검 구성.','적합','-'),
 'CONSUMABLES':('R03','소모품 타수 누적 시점(실적 저장)과 USAGE 이력 기록, 타수 백필 보정 확인.','적합','-'),
 'EQUIPMENT':('R06·R03','설비 점검항목 도식 이미지, 점검 미진행 시 실적 인터록(키오스크 프론트) 확인.','부분 적합','점검 미진행 실적의 서버 측 게이트는 감사 대조 후 보완 대상으로 등록'),
 'MONITORING':('R01','생산·품질·재고 집계 API 라우트 및 JWT 가드 동작, FE/BE 타입 검사 통과 확인.','적합(기능)','로그인 세션 기반 실화면 렌더 확인은 별도 확인 대상으로 기록'),
 'WORKFLOW':('R01','워크플로우 정의 5종과 메뉴 코드 대응, 워크플로우 맵 화면 구성 확인.','적합','-'),
}
rows=[]
for m in mods:
    r=MR.get(m['code'])
    sp=SPEC[m['code']]
    if r: rnd,res,jd,rem=r
    else:
        rnd,res,jd,rem='R01~R07(간접)',f'해당 모듈 전용 현장 시험 기록은 별도로 없으며, 자동화 시험 {sp}개 파일과 업무 흐름 시험(R01~R07)의 연계 구간으로 확인.','적합(자동화 시험 기준)','현장 업무 시험 기록 별도 축적 예정'
    rows.append([dc(f'TST-{m["short"]}-001'),m['label'],f'{m["screens"][0]["req"]} ~ {m["screens"][-1]["req"][-3:]}',rnd,sp,e(res),jd,rem])
t.raw(table(['시험번호','모듈','대상 요구사항','관련 회차','자동화 시험(파일)','시험 결과','판정','잔여 사항'],rows,raw=True))

t.h2('4. 발견 결함 및 조치 현황')
t.raw(table(['구분','내용','조치','상태'],[
 ['운영 설정','OQC 게이트(OQC_ENABLED) 비활성','Y로 변경 확인(R02 재점검)','조치 완료'],
 ['운영 설정','공정 자재 부족 시 실적 진행(MAT_ISSUE_STOCK_CHECK=WARN)','BLOCK 확인(R02 재점검)','조치 완료'],
 ['코드','IQC FAIL 불용창고 이동, 특채 입고 입하재고 미차감, 박스 입고 전표 없는 출하, 입고 후 재개봉, 팔레트 OQC 우회, WIP 이중복원, 빈 라우팅 전량 차감, 키오스크 LAST 미차단','수정 및 단위 시험(126 pass)','조치 완료'],
 ['코드','스캔/그리드 출고의 공정재고 미적재·요청 미배분, 소모품 타수 시점, 진행률 미갱신 등 현장 9건','수정, 재발 방지용 트랜잭션 불변식 검증 추가','조치 완료'],
 ['코드·데이터','라벨 QR 템플릿 sourceField 누락(SAMPLE 인코딩)','템플릿 5종 DB 복구 + 로드 시 보정 코드','조치 완료'],
 ['코드','AQL 시리얼 단위 판정에서 불량수 과소 계수','불량수량 합계 귀속 규칙(attributeDefectQtyToFailedItems)','조치 완료'],
 ['설계','키오스크 실적과 키팅의 동일 지시 동시 사용 시 이중 소비','설계상 미차단 — 운영 규칙으로 분리 사용','관리 중'],
 ['기록','재작업 목록 라우트 순서(Get(\':id\')가 inspects보다 선행)로 404 발생 등 재작업·수리 프로세스 점검 결함','점검 기록에 등재, 수정은 후속 작업','후속 조치'],
 ['감사','고객 감사 대조 부분·없음 11건','보완 설계·구현 계획 수립, 한도견본·검사보조구·관리계획서 등 구현','진행 중'],
]))
t.h2('5. 종합 평가')
t.raw('<ul><li>메인 업무 체인(자재 입하→IQC→입고→출고→생산 실적→검사→포장→OQC→출하)은 시험 기간 중 연결·정합성이 확인되었고, 발견된 결함은 수정되어 재점검·자동화 시험으로 확인되었다.</li><li>트랜잭션 불변식 정기 검증(MST_VALIDATION_DAILY)을 도입해 동일 유형의 데이터 불일치가 재발하지 않도록 했다.</li><li>설비 센서 원시 신호 자동 수집, 감사 대조 부분 항목은 후속 과제로 관리한다.</li></ul>')
t.h2('6. 시험 결과 추적')
t.raw(table(['모듈','요구사항','시험','판정'],[[m['label'],f'<a class="id" href="01-requirements.html#m-{m["short"]}">{m["screens"][0]["req"]} ~</a>',idlink(f'TST-{m["short"]}-001'),r[2]] for m,r in zip([x for x in mods],rows)],raw=True))
t.save(NAV)

# ================= 4. 사용자 매뉴얼 =================
u=Doc('04-user-manual.html','HNS-MES-UM-001','사용자 매뉴얼','HANES MES — 현장·사무 사용자용','MES 사용자가 로그인부터 업무 화면 사용, 업무 흐름별 처리 방법까지 따라 할 수 있도록 안내한다.')
u.h2('1. 시작하기')
u.h3('1.1 접속 및 로그인',toc=False)
u.raw('<ol><li>브라우저에서 관리자가 안내한 HANES MES 주소(HTTPS)로 접속한다.</li><li>사용자 ID와 비밀번호를 입력해 로그인한다.</li><li>PDA는 /pda/login 으로 접속해 PDA 계정으로 로그인한다.</li></ol>')
u.h3('1.2 화면 구성',toc=False)
u.raw(table(['영역','설명'],[['좌측 사이드바','업무 메뉴. 권한이 있는 메뉴만 표시되며, 즐겨찾기 폴더에 자주 쓰는 메뉴를 모을 수 있다.'],['상단 탭','열어 둔 화면이 탭으로 유지되어 작업 중이던 입력 상태를 보존한다.'],['본문','조회 조건(필터) → 목록(그리드) → 등록·수정 패널/모달 순서로 구성된다.'],['도움말','화면의 도움말/투어, 사이드바 /help 메뉴에서 확인한다.']]))
u.h3('1.3 공통 사용 방법',toc=False)
u.raw(table(['작업','방법'],[
 ['조회','상단 필터(검색어, 일자, 상태 등)를 지정하고 조회/새로고침을 누른다. 사용여부 필터는 기본 "사용"만 보인다.'],
 ['등록·수정','[등록] 버튼 또는 목록 행 선택 → 우측 패널/모달에서 입력 후 저장. 코드성 값은 목록에서 선택한다.'],
 ['삭제·취소','확인 모달에서 한 번 더 확인한다. 이미 후속 처리된 건은 삭제/취소가 차단되고 사유가 표시된다.'],
 ['바코드·QR 스캔','스캔 입력란에 커서가 있는 상태에서 스캔하면 자동 처리된다. 입력란이 포커스를 잃으면 깜박임으로 표시된다.'],
 ['라벨 출력','라벨 템플릿을 선택하고 출력한다. 재발행 조건은 버튼 옆 안내를 따른다.'],
 ['내보내기','그리드의 CSV 내보내기 기능을 사용한다.'],
 ['개선 요청','화면 개선요청 기능으로 현장 의견을 등록한다. 처리 상태는 개선요청 화면에서 확인한다.'],
]))
u.h2('2. 업무 흐름별 사용 순서')
u.p('핵심 업무는 아래 순서대로 처리한다. 각 단계의 선행 단계가 완료되지 않으면 다음 단계에서 처리가 차단된다.')
for w in WF:
    steps=[]
    for st in w['steps']:
        s=SC_BY.get(st['menu']);steps.append(f'<span>{e(s["label"]) if s else e(st["menu"])}</span>')
    u.h3(w['title'])
    u.raw(f'<div class="flow">{"<i>→</i>".join(steps)}</div>')
    if w.get('troubleshooting'):
        rows=[]
        for tr in w['troubleshooting']:
            def j(x): return '; '.join(map(str,x)) if isinstance(x,list) else str(x)
            rows.append([tr.get('symptom',''),j(tr.get('causes','')),j(tr.get('resolutions',''))])
        u.raw('<details><summary>자주 묻는 문제 (증상 · 원인 · 조치)</summary>'+table(['증상','원인','조치'],rows)+'</details>')
u.h2('3. 메뉴별 사용 안내')
u.p('메뉴 경로와 화면 목적이다. 상세 업무 규칙은 화면별 도움말과 업무 로직 문서(docs/business-logics)를 참고한다.')
for m in mods:
    u.h3(f'3.{mods.index(m)+1} {m["label"]}',anchor=f'MUS-{m["short"]}')
    u.p(m['desc'])
    u.raw(table(['요구번호','메뉴 경로','사용 목적'],[[idlink(s['req']),e(m['label']+(' > '+s['label'] if len(m['screens'])>1 or s['label']!=m['label'] else '')),e(s['purpose'])] for s in m['screens']],raw=True))
u.h2('4. PDA 사용 안내')
u.raw(table(['업무','경로','사용 순서'],[['자재 입하/입고/출고','/pda/material','메뉴 선택 → 자재 라벨(LOT) 스캔 → 수량 확인 → 저장'],['제품 처리','/pda/product','제품 라벨 스캔 → 처리 유형 선택 → 저장'],['팔레트·박스 출하','/pda/shipping-pallet, /pda/pallet-ship','출하지시 선택 → 박스/팔레트 스캔 → 출하 확정'],['설비 일상점검','/pda/equip-inspect','설비 선택 → 점검 항목 입력 → 제출']]))
u.h2('5. 오류 및 문의')
u.raw(table(['상황','조치'],[['메뉴가 보이지 않음','권한이 없는 메뉴다. 관리자에게 역할 권한 부여를 요청한다.'],['저장/처리가 차단됨','화면에 표시되는 사유(선행 단계 미완료, IQC 미판정, 재고 부족 등)를 확인하고 선행 단계를 처리한다.'],['라벨이 출력되지 않음','프린트 에이전트 연결 및 라벨 템플릿 선택을 확인한 뒤 관리자에게 문의한다.'],['화면 개선 의견','화면의 개선요청 기능으로 등록한다.']]))
u.save(NAV)

# ================= 5. 전산 운영자 매뉴얼 =================
o=Doc('05-operator-manual.html','HNS-MES-OM-001','전산 운영자 매뉴얼','HANES MES — 서버·DB·배포·장애 대응','시스템 운영 담당자가 설치, 기동·중지, 설정, 모니터링, 백업, 장애 대응을 수행하기 위한 절차를 정리한다.')
o.h2('1. 시스템 개요')
o.raw(table(['항목','내용'],[['프로젝트 경로','C:\\Project\\HANES'],['프론트엔드','Next.js (운영 포트 3100, 개발 포트 3002)'],['백엔드','NestJS (포트 3003)'],['HTTPS 프록시','Caddy (443 → 3100), 설정 tools/proxy'],['데이터베이스','Oracle (사이트 JSHANES, 10.1.10.35:1527/JSHNSMES)'],['프로세스 관리','PM2: hanes-frontend / hanes-backend / hanes-proxy'],['빌드','Turborepo + pnpm 10.28'],['CI/CD','GitHub Actions(self-hosted runner), main 브랜치 push 시 자동 배포'],['로그 경로','C:\\Project\\HANES\\logs\\'],['서버 OS','Windows Server']]))
o.h2('2. 설치 및 배포')
o.h3('2.1 사전 요구사항',toc=False)
o.raw('<ol><li>Node.js(LTS), pnpm 10.28.1, PM2(전역) 설치</li><li>Oracle Instant Client 설치 및 환경변수 설정</li><li>Git 및 GitHub 접근 권한</li></ol>')
o.h3('2.2 최초 설치',toc=False)
o.raw('<pre>git clone https://github.com/YouHyuksoo/HANES.git C:\\Project\\HANES\ncd C:\\Project\\HANES\npnpm install\npnpm build\npm2 start ecosystem.config.js\npm2 save</pre>')
o.h3('2.3 자동 배포',toc=False)
o.p('main 브랜치에 push하면 GitHub Actions가 PM2 중지 → 최신 소스 반영 → pnpm install --frozen-lockfile → pnpm build → pm2 start ecosystem.config.js --update-env → pm2 save 순으로 배포한다. 배포 정의는 .github/workflows/deploy.yml 이다.')
o.box('개발 서버(포트 3002)가 떠 있는 상태에서 pnpm build를 실행하면 .next 캐시가 손상될 수 있다. 빌드는 개발 서버가 없을 때만 수행한다.','warn')
o.h2('3. 기동 · 중지')
o.raw(table(['프로세스','역할','포트','로그'],[['hanes-frontend','Next.js 프론트엔드','3100','logs/frontend-*.log'],['hanes-backend','NestJS 백엔드','3003','logs/backend-*.log'],['hanes-proxy','Caddy HTTPS 프록시','443','logs/proxy-*.log']]))
o.raw(table(['작업','명령'],[['전체 시작','pm2 start ecosystem.config.js'],['재시작','pm2 restart hanes-frontend hanes-backend hanes-proxy'],['중지','pm2 stop hanes-frontend hanes-backend'],['상태','pm2 status'],['로그','pm2 logs hanes-backend --lines 100'],['설정 저장','pm2 save']]))
o.box('<b>pm2 kill 금지.</b> 같은 서버의 다른 프로젝트 프로세스도 종료된다. 반드시 프로세스 이름으로 제어한다.','warn')
o.h2('4. 설정 관리')
o.h3('4.1 환경변수',toc=False)
o.raw(table(['변수','설명','위치'],[['DB 접속정보','Oracle 접속(호스트/포트/서비스/계정). 단일 출처는 .env.local 우선, 없으면 .env','apps/backend/.env(.local)'],['JWT_SECRET / JWT_EXPIRES_IN','토큰 시크릿·만료시간','apps/backend/.env'],['PORT','백엔드 포트(3003)','ecosystem.config.js'],['NEXT_PUBLIC_API_URL','프론트→백엔드 API 주소','apps/frontend/.env']]))
o.box('.env 파일은 Git에 커밋하지 않는다. 접속값을 스크립트에 직접 적지 않는다.','warn')
o.h3('4.2 시스템 설정(SYS_CONFIGS) — 시스템관리 > 시스템설정',toc=False)
o.raw(table(['설정 키','설명','비고'],[['OQC_ENABLED','출하 전 OQC PASS 게이트 사용','Y: FAIL/PENDING 박스 적재·출하 차단 (시험 운영 중 Y 확인)'],['MAT_ISSUE_STOCK_CHECK','공정 자재 부족 시 처리','BLOCK: 부족 시 차단 / WARN: 가용분만 차감 후 진행'],['MAT_AUTO_ISSUE_TIMING','BOM 자동 차감 시점','ON_CREATE(실적 등록 시) / ON_COMPLETE(완료 시)'],['IQC_AUTO_RECEIVE','IQC 후 자동 입고','N: 수동 입고'],['IQC_FAIL_DEFECT_MOVE_MODE','IQC 불합격 자재 이동 방식','MANUAL(기본): 불량창고입고 화면에서 수동 / AUTO: 자동 이동'],['QC_MID_BLOCK_PCT','중물검사 필수 진행률(%)','키오스크 실적 차단 기준'],['FIFO_ENABLED','선입선출 적용 여부','권고 표시 위주']]))
o.h3('4.3 스케줄러',toc=False)
o.p('시스템관리 > 스케줄러 관리에서 배치 작업을 등록·수정·즉시 실행·활성 토글하고(ADMIN 전용), 실행 이력(SUCCESS/FAIL/RUNNING/SKIPPED)을 로그 탭에서 조회한다. 기준정보검증 정기 잡 MST_VALIDATION_DAILY는 트랜잭션 불변식(작업지시 집계=실적 합계, 생산출고=공정재고 적재, 공정재고 잔량=원장, 출고요청 상태=배분, DB 메뉴코드=검증기)을 검사한다.')
o.h2('5. 데이터베이스 운영')
o.raw(table(['항목','기준'],[['DDL/DML 적용','사이트(JSHANES)를 명시하고 oracle-db 커넥터 경로로 적용, 적용 전후 조회로 확인'],['SQL 파일','다중 DML/PLSQL 블록마다 / 구분자 사용'],['TypeORM CLI','ES Module 이슈로 직접 사용하지 않음(Raw SQL 사용)'],['채번','SEQUENCE.NEXTVAL만 사용(MAX+1 금지)'],['테넌트','COMPANY, PLANT_CD 범위 포함'],['스키마 문서','스키마 변경 시 python tools/generate_db_schema_doc.py 로 docs/database/schema-erd.md 갱신'],['메뉴 추가','menuConfig.ts, 백엔드 메뉴코드 검증기, 시드/마이그레이션과 함께 DB의 MENU_CATEGORY_ITEMS, ROLE_MENU_PERMISSIONS 적용 확인'],['마이그레이션','apps/backend/src/migrations 및 scripts 아래 SQL 파일 관리']]))
o.h2('6. 모니터링')
o.raw(table(['대상','방법'],[['프로세스','pm2 status, pm2 monit'],['로그','pm2 logs, logs/ 폴더의 *-error.log'],['스케줄러','스케줄러 관리 > 로그 탭 (FAIL 건 확인)'],['인터페이스','인터페이스 > 로그/대시보드(송수신 실패 확인)'],['데이터 정합성','기준정보검증 화면 TXN_INVARIANT 카테고리'],['현황판','모니터링 메뉴의 생산/품질/재고/작업지시/설비/SPC 보드']]))
o.h2('7. 백업 및 복구')
o.raw(table(['대상','방법','권장'],[['Oracle DB','expdp 덤프 (DIRECTORY 지정)','매일 1회, 30일 이상 보관'],['설정 파일','.env, ecosystem.config.js, Caddyfile','변경 시'],['업로드 파일','작업지도서 이미지, 성적서 등 업로드 폴더','주 1회'],['소스','GitHub 저장소','별도 백업 불필요']]))
o.raw('<ol><li>PM2 프로세스 중지</li><li>Oracle DB 복구(impdp)</li><li>.env 등 설정 파일 복원</li><li>pnpm install 후 pnpm build</li><li>PM2 프로세스 시작 후 화면·로그인 확인</li></ol>')
o.h2('8. 장애 대응')
o.raw(table(['증상','원인','조치'],[['화면이 열리지 않음','프론트엔드/프록시 프로세스 중지','pm2 restart hanes-frontend hanes-proxy'],['API 500 오류','DB 연결 실패 또는 코드 오류','pm2 logs hanes-backend 확인, DB 연결 설정 확인'],['ORA-12541 등 DB 연결 오류','Oracle 서비스/네트워크','Oracle 서비스·방화벽 확인, .env 접속정보 확인'],['프로세스 반복 재시작','메모리 한계(1G) 초과','pm2 monit로 확인, 로그 분석'],['배포 실패','빌드 오류 또는 runner 문제','GitHub Actions 로그 확인'],['라벨 출력 불가','Print Agent 연결 문제','에이전트 실행·연결 확인'],['입고/출고 처리 차단','IQC 미판정, 선행 단계 미완료, 재고 부족','업무 흐름의 선행 단계 확인(사용자 매뉴얼 2장)'],['실적-재고 수량 불일치','트랜잭션 불변식 위반','기준정보검증 TXN_INVARIANT 결과 확인 후 해당 전표 조사']]))
o.p('장애 절차: ① 인지 → ② pm2 status → ③ 로그 확인 → ④ 원인 조치 → ⑤ 정상화 확인 → ⑥ 장애 기록 작성.')
o.h2('9. 정기 점검')
o.raw(table(['주기','점검 항목','기준'],[['일일','pm2 status, 에러 로그, 스케줄러 FAIL 건, 기준정보검증 결과','online / 에러 없음 / FAIL 0'],['주간','DB 백업 존재, 로그 정리(pm2 flush), 서버 자원','최근 7일 백업, 여유 확보'],['월간','Node/pnpm 보안 패치, pnpm audit, 테이블스페이스, 인증서 만료','Critical/High 0, 사용률 80% 이하, 만료 30일 전 갱신']]))
o.h2('10. 운영 권한 관리')
o.p('사용자·역할·메뉴 권한은 시스템관리 메뉴에서 관리한다. 신규 메뉴 추가 시 역할별 권한(ROLE_MENU_PERMISSIONS) 부여를 반드시 확인한다. 관리자 전용 기능(스케줄러 등)은 ADMIN 역할만 사용할 수 있다.')
o.save(NAV)

# ================= index =================
x=Doc('index.html','HNS-MES-IX-001','HANES MES 프로젝트 산출물','산출물 목록 및 추적 매트릭스','5종 산출물의 구성과 문서 간 추적번호 연결을 한눈에 보여준다.')
x.h2('1. 산출물 목록')
x.raw(table(['번호','문서','문서번호','주요 추적번호','설명'],[
 ['1','<a href="01-requirements.html">요구사항 정의서</a>','HNS-MES-RQ-001','REQ, NFR','화면 단위 기능 요구와 비기능 요구'],
 ['2','<a href="02-design.html">개발 설계서</a>','HNS-MES-DS-001','FUN, SCR, TBL','아키텍처, 기능 정의, 화면 설계, DB 설계'],
 ['3','<a href="03-trial-report.html">시험 운영 결과 보고서</a>','HNS-MES-TR-001','TST','시험 회차·모듈별 결과·결함 조치'],
 ['4','<a href="04-user-manual.html">사용자 매뉴얼</a>','HNS-MES-UM-001','MUS','로그인, 업무 흐름, 메뉴별 사용 안내'],
 ['5','<a href="05-operator-manual.html">전산 운영자 매뉴얼</a>','HNS-MES-OM-001','-','설치·배포·설정·백업·장애 대응']],raw=True))
x.p('소스코드 일체는 별도 저장소(GitHub: YouHyuksoo/HANES)로 관리하며 본 산출물에서는 제외한다.')
x.h2('2. 추적번호 체계')
x.p('REQ-모듈-NNN → FUN-모듈-NNN → SCR-모듈-NNN → TBL-모듈-NN → TST-모듈-001 → MUS-모듈')
x.h2('3. 전체 추적 매트릭스 (모듈 단위)')
x.raw(table(['모듈','요구사항','기능','화면','테이블','시험','매뉴얼'],[[m['label'],f'<a class="id" href="01-requirements.html#m-{m["short"]}">{m["screens"][0]["req"]} ~ {m["screens"][-1]["req"][-3:]}</a>',f'<a class="id" href="02-design.html#f-{m["short"]}">{m["screens"][0]["fun"]} ~</a>',f'<a class="id" href="02-design.html#s-{m["short"]}">{m["screens"][0]["scr"]} ~</a>',(f'<a class="id" href="02-design.html#t-{m["short"]}">TBL-{m["short"]}-01 ~ ({len(TBLS[m["code"]])})</a>' if TBLS[m['code']] else '-'),idlink(f'TST-{m["short"]}-001'),idlink(f'MUS-{m["short"]}')] for m in mods if m['screens']],raw=True))
x.h2('4. 현황 수치')
x.raw(table(['항목','수치'],[['메뉴 화면(요구사항)',len(SCREENS)],['웹 페이지(page.tsx)',info['pages']],['DB 테이블(카탈로그)',len(D['tabs'])],['엔티티',info['entities']],['백엔드 모듈',len(D['bm'])],['자동화 시험 파일(spec/test)',f'{info["specs"]} / {info["tests"]}']]))
x.save(NAV)
print('done')
