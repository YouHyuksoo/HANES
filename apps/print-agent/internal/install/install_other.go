//go:build !windows

// 비 Windows 환경에서는 자기 설치를 수행하지 않는다(현재 위치에서 그대로 동작).
package install

// EnsureInstalled 는 비 Windows 에서 항상 false 를 반환한다.
func EnsureInstalled() (relaunched bool) { return false }
