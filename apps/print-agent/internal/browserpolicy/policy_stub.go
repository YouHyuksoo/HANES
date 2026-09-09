//go:build !windows

package browserpolicy

// Sync 는 Windows 외 플랫폼에서는 아무 것도 하지 않는다(개발용 빌드).
func Sync(_ []string) error { return nil }

// Registered 는 Windows 외 플랫폼에서는 항상 0 이다.
func Registered() (int, error) { return 0, nil }
