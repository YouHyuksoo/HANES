package browserpolicy

import (
	"reflect"
	"testing"
)

func TestPolicyOrigins(t *testing.T) {
	got := PolicyOrigins([]string{
		"http://localhost:3002",           // 같은 주소 공간 — 불필요
		"http://127.0.0.1:3002",           // 불필요
		"http://hswbs.haengsung.com:3002", // http 는 정책으로 못 푼다
		" https://hswbs.haengsung.com/ ",  // 공백·슬래시 정규화
		"https://HSWBS.haengsung.com:443", // 기본 포트 생략, 소문자
		"https://hswbs.haengsung.com",     // 중복
		"https://mes.example.com:8443",    // 비표준 포트 유지
		"*",
		"",
		"not a url",
	})
	want := []string{"https://hswbs.haengsung.com", "https://mes.example.com:8443"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("PolicyOrigins = %v, want %v", got, want)
	}
}

func TestPolicyOriginsEmpty(t *testing.T) {
	if got := PolicyOrigins(nil); len(got) != 0 {
		t.Fatalf("expected empty, got %v", got)
	}
}
