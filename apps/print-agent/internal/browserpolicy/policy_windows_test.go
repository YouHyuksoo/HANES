//go:build windows

package browserpolicy

import (
	"os/exec"
	"strings"
	"testing"
)

// 실제 reg.exe 로 임시 키(HKCU\SOFTWARE\HANESTest\...)에 쓰고 지운다 — 브라우저 정책 키는 건드리지 않는다.
func TestSyncWritesAndClearsKey(t *testing.T) {
	saved := policyKeys
	testKey := `HKCU\SOFTWARE\HANESTest\browserpolicy\LocalNetworkAccessAllowedForUrls`
	policyKeys = []string{testKey}
	t.Cleanup(func() {
		policyKeys = saved
		_ = exec.Command("reg", "delete", `HKCU\SOFTWARE\HANESTest`, "/f").Run()
	})

	if err := Sync([]string{"https://hswbs.haengsung.com", "https://mes.example.com:8443"}); err != nil {
		t.Fatalf("Sync: %v", err)
	}
	out, err := exec.Command("reg", "query", testKey).CombinedOutput()
	if err != nil {
		t.Fatalf("reg query: %v\n%s", err, out)
	}
	text := string(out)
	if !strings.Contains(text, "https://hswbs.haengsung.com") || !strings.Contains(text, "https://mes.example.com:8443") {
		t.Fatalf("values not written:\n%s", text)
	}
	if n, _ := Registered(); n != 2 {
		t.Fatalf("Registered = %d, want 2", n)
	}

	// 교체: 하나만 남긴다 (예전 값 2 가 남아 있으면 안 된다)
	if err := Sync([]string{"https://hswbs.haengsung.com"}); err != nil {
		t.Fatalf("Sync replace: %v", err)
	}
	out, _ = exec.Command("reg", "query", testKey).CombinedOutput()
	if strings.Contains(string(out), "mes.example.com") {
		t.Fatalf("stale value remained:\n%s", out)
	}

	// 비우면 키 삭제
	if err := Sync(nil); err != nil {
		t.Fatalf("Sync clear: %v", err)
	}
	if err := exec.Command("reg", "query", testKey).Run(); err == nil {
		t.Fatalf("key should be deleted")
	}
}
