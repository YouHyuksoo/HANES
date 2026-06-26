//go:build !windows

// 비 Windows 환경(개발/테스트)에서는 자동 시작 등록을 지원하지 않으므로 no-op 으로 둔다.
package autostart

// Enable 은 비 Windows 에서 아무 동작도 하지 않는다.
func Enable() error { return nil }

// Disable 은 비 Windows 에서 아무 동작도 하지 않는다.
func Disable() error { return nil }

// Enabled 는 비 Windows 에서 항상 false 를 반환한다.
func Enabled() (bool, error) { return false, nil }
