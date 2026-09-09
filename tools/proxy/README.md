# HANES HTTPS 프록시 (Caddy)

배포 서버에서 `https://hswbs.haengsung.com`(443)을 받아 Next(3002)로 넘기는 리버스 프록시다.
GitHub Actions `deploy.yml` 의 "Prepare HTTPS proxy" 단계가 `caddy.exe` 를 내려받고 방화벽 규칙을 만들며,
`ecosystem.config.js` 의 `hanes-proxy` 로 PM2 가 상주시킨다.

| 항목 | 값 |
|---|---|
| 설정 | `tools/proxy/Caddyfile` |
| 실행파일 | `tools/proxy/caddy.exe` (gitignore, 배포 시 자동 다운로드) |
| 인증서 저장 | `C:\ProgramData\HANES\caddy` (XDG_DATA_HOME) |
| 접근 로그 | `C:\Project\HANES\logs\proxy-access.log` |
| HTTP 리스너 | 3080 (서버 80 과 충돌 방지, 외부 미개방) |

## 왜 필요한가

http 공인 주소에서는 Chrome 이 `127.0.0.1:37111`(Print Agent) 요청을 "비보안 컨텍스트 → loopback" 정책으로 차단한다.
https 페이지에서는 허용되므로 라벨 출력이 에이전트로 동작한다. Chrome 정책(레지스트리)으로는 우회가 불가함을 2026-09-09 에 실측했다.

## 전환 후 할 일

1. 각 PC 의 Print Agent 설정(`http://127.0.0.1:37111/settings`) 허용 Origin 에 `https://hswbs.haengsung.com` 추가
   (에이전트 기본값에도 포함돼 있어 새로 설치하는 PC 는 불필요).
2. 사용자 접속 주소를 `https://hswbs.haengsung.com` 으로 안내. Chrome 이 사이트당 1회 "로컬 네트워크 접근 허용" 을 물으면 허용.
3. 안정화 후 3002 외부 포트포워딩을 닫는다.

## 장애 시

- `pm2 logs hanes-proxy` 로 인증서 발급 로그 확인. 발급 실패의 흔한 원인은 외부 443 미개방/서버 방화벽.
- 443 을 다른 프로그램이 쓰면 워크플로 "Prepare HTTPS proxy" 단계가 실패한다. 그 경우 Caddyfile `https_port` 와 포트포워딩 내부 포트를 함께 바꾼다.
