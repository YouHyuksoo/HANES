//go:build windows

package browserpolicy

import (
	"fmt"
	"os/exec"
	"strconv"
	"syscall"
)

// 브라우저별 정책 키(HKCU = 현재 사용자, 관리자 권한 불필요). 테스트에서 임시 키로 바꿔 쓴다.
var policyKeys = []string{
	`HKCU\SOFTWARE\Policies\Google\Chrome\LocalNetworkAccessAllowedForUrls`,
	`HKCU\SOFTWARE\Policies\Microsoft\Edge\LocalNetworkAccessAllowedForUrls`,
}

func hiddenCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

// Sync 는 정책 키를 origins 로 통째로 교체한다(1..n 값). origins 가 비면 키를 지운다.
// 이 키는 HANES Print Agent 전용으로 취급한다 — 같은 키를 다른 관리 도구가 쓰면 그쪽 값이 덮인다.
func Sync(origins []string) error {
	var firstErr error
	for _, key := range policyKeys {
		if err := syncKey(key, origins); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func syncKey(key string, origins []string) error {
	// 키가 없을 때 reg delete 는 exit 1 → 무시
	_ = hiddenCmd("reg", "delete", key, "/f").Run()
	if len(origins) == 0 {
		return nil
	}
	for i, origin := range origins {
		if err := hiddenCmd("reg", "add", key, "/v", strconv.Itoa(i+1), "/t", "REG_SZ", "/d", origin, "/f").Run(); err != nil {
			return fmt.Errorf("browser policy %s: %w", key, err)
		}
	}
	return nil
}

// Registered 는 첫 번째 정책 키에 등록된 값 개수를 돌려준다(상태 확인용).
func Registered() (int, error) {
	out, err := hiddenCmd("reg", "query", policyKeys[0]).CombinedOutput()
	if err != nil {
		return 0, nil // 미등록
	}
	count := 0
	for _, line := range splitLines(string(out)) {
		if containsFold(line, "REG_SZ") {
			count++
		}
	}
	return count, nil
}
