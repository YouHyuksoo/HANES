//go:build windows

// Package install 은 다운로드 폴더 등 임시 위치에서 처음 실행된 경우,
// 실행파일을 고정 설치 위치(%AppData%\HANES\print-agent\)로 자기 복사한 뒤
// 설치본을 실행하고 임시 프로세스를 종료시킨다.
//
// 이렇게 하면 사용자가 받은 파일을 어디서 실행하든 자동 시작 등록 경로가
// 항상 고정 위치를 가리키게 되어, 다운로드 파일을 옮기거나 지워도 깨지지 않는다.
package install

import (
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

const exeName = "hanes-print-agent.exe"

// InstalledPath 는 고정 설치 위치의 실행파일 전체 경로다(config.json 과 같은 폴더).
func InstalledPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "HANES", "print-agent", exeName), nil
}

// EnsureInstalled 는 현재 실행 위치가 고정 설치 위치가 아니면 그 위치로 복사한 뒤
// 설치본을 실행하고 relaunched=true 를 반환한다. 호출자는 true 면 현재 프로세스를 종료해야 한다.
// 이미 설치 위치에서 실행 중이거나 복사/실행에 실패하면 false 를 반환해 현재 위치에서 계속 동작한다.
func EnsureInstalled() (relaunched bool) {
	target, err := InstalledPath()
	if err != nil {
		return false
	}
	current, err := os.Executable()
	if err != nil {
		return false
	}
	if resolved, err := filepath.EvalSymlinks(current); err == nil && resolved != "" {
		current = resolved
	}

	if strings.EqualFold(filepath.Clean(current), filepath.Clean(target)) {
		return false // 이미 설치 위치에서 실행 중
	}

	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return false // 설치 폴더를 만들 수 없으면 현재 위치에서 그대로 동작
	}

	// 설치본이 이미 실행 중이면 덮어쓰기가 실패할 수 있다. 그 경우에도 기존 설치본을
	// 실행해 보고(포트 중복이면 새 인스턴스가 알아서 종료) 임시 프로세스는 끝낸다.
	_ = copyFile(current, target)

	if err := launch(target); err != nil {
		return false
	}
	return true
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	tmp := dst + ".new"
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}

	// 실행 중이던 기존 설치본은 잠겨 있어 Remove/Rename 이 실패할 수 있다(정상).
	_ = os.Remove(dst)
	if err := os.Rename(tmp, dst); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}

func launch(path string) error {
	cmd := exec.Command(path)
	cmd.Dir = filepath.Dir(path)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Start() // 부모와 독립적으로 상주
}
