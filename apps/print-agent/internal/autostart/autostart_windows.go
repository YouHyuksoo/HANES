//go:build windows

// Package autostart 는 HANES Print Agent 를 Windows 로그인 시 자동 실행되도록
// 현재 사용자(HKCU) Run 레지스트리에 등록/해제한다.
//
// HKCU 를 사용하므로 관리자 권한이 필요 없다. 의존성을 추가하지 않기 위해
// Windows 기본 제공 reg.exe 를 호출하며, 콘솔 창이 깜빡이지 않도록 숨겨 실행한다.
package autostart

import (
	"os"
	"os/exec"
	"strings"
	"syscall"
)

const (
	runKeyPath = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
	valueName  = "HANESPrintAgent"
)

func hiddenCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

// Enable 은 현재 실행파일 경로를 HKCU Run 에 등록한다(이미 있으면 덮어씀).
func Enable() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	// 경로에 공백이 있어도 안전하도록 따옴표로 감싼다.
	value := `"` + exe + `"`
	return hiddenCmd("reg", "add", runKeyPath, "/v", valueName, "/t", "REG_SZ", "/d", value, "/f").Run()
}

// Disable 은 HKCU Run 등록을 제거한다(등록이 없으면 정상 처리).
func Disable() error {
	err := hiddenCmd("reg", "delete", runKeyPath, "/v", valueName, "/f").Run()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			// 값이 존재하지 않으면 reg 는 exit code 1 을 반환 → 이미 해제 상태로 간주.
			return nil
		}
	}
	return err
}

// Enabled 는 현재 실행파일 경로로 자동 실행이 등록돼 있는지 확인한다.
func Enabled() (bool, error) {
	exe, err := os.Executable()
	if err != nil {
		return false, err
	}
	out, err := hiddenCmd("reg", "query", runKeyPath, "/v", valueName).CombinedOutput()
	if err != nil {
		// 미등록이면 reg query 가 exit code 1 → 에러가 아니라 "꺼짐"으로 본다.
		return false, nil
	}
	return strings.Contains(strings.ToLower(string(out)), strings.ToLower(exe)), nil
}
