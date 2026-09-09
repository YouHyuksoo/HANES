// Package browserpolicy 는 브라우저(Chrome/Edge)의 "로컬 네트워크 접근" 정책을 이 PC 의 사용자 레지스트리에
// 자동 등록해, https MES 페이지가 127.0.0.1 Print Agent 에 확인창 없이 연결되게 한다.
//
// 배경(2026-09-09 실측, Chrome 153):
//   - http 공인 주소 페이지 → loopback 요청은 "비보안 컨텍스트" 사유로 정책과 무관하게 차단된다(우회 불가).
//   - https 페이지 → loopback 요청은 사용자에게 "로컬 네트워크 접근 허용" 을 묻는다(권한). 이때
//     LocalNetworkAccessAllowedForUrls 정책에 그 origin 이 있으면 확인창 없이 허용된다.
//
// 따라서 허용 Origin 목록 중 https origin 만 정책에 올린다. 값은 HKCU 에 쓰므로 관리자 권한이 필요 없고,
// Chrome 은 정책 새로고침(chrome://policy) 또는 재시작 후 반영한다.
package browserpolicy

import (
	"net/url"
	"strings"
)

// PolicyOrigins 는 허용 Origin 목록에서 브라우저 정책에 등록할 https origin 만 골라 정규화(scheme://host[:port])하고
// 중복을 제거한다. localhost/127.0.0.1 은 같은 주소 공간이라 정책이 필요 없고, http origin 은 정책으로 풀리지 않는다.
func PolicyOrigins(allowed []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(allowed))
	for _, raw := range allowed {
		s := strings.TrimSpace(raw)
		if s == "" || s == "*" {
			continue
		}
		u, err := url.Parse(s)
		if err != nil || !strings.EqualFold(u.Scheme, "https") || u.Host == "" {
			continue
		}
		host := strings.ToLower(u.Hostname())
		if host == "localhost" || host == "127.0.0.1" {
			continue
		}
		origin := "https://" + host
		if p := u.Port(); p != "" && p != "443" {
			origin += ":" + p
		}
		if seen[origin] {
			continue
		}
		seen[origin] = true
		out = append(out, origin)
	}
	return out
}
