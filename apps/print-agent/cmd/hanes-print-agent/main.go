package main

import (
	"log"

	"hanes/print-agent/internal/autostart"
	"hanes/print-agent/internal/config"
	"hanes/print-agent/internal/install"
	"hanes/print-agent/internal/printer"
	"hanes/print-agent/internal/server"
)

func main() {
	// 임시 위치(다운로드 폴더 등)에서 처음 실행되면 고정 위치로 자기 설치 후 재실행한다.
	// 재실행되었으면 이 임시 프로세스는 즉시 종료한다.
	if install.EnsureInstalled() {
		return
	}

	cfg, configPath, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	ensureAutoStart(&cfg, configPath)

	backend := printer.New()
	srv := server.NewWithConfigPath(&cfg, configPath, backend)
	if err := runAgent(cfg, configPath, srv, backend); err != nil {
		log.Fatal(err)
	}
}

// ensureAutoStart 는 최초 실행 시 사용자 개입 없이 Windows 자동 시작을 기본 등록하고,
// 이후 실행에서는 사용자가 정한 값(cfg.AutoStart)을 따른다.
// 켜짐 상태인데 레지스트리에서 등록이 사라졌으면 자동으로 재등록한다(자가 복구).
func ensureAutoStart(cfg *config.Config, configPath string) {
	if cfg.AutoStart == nil {
		// 최초 실행: 자동 시작 기본 ON.
		if err := autostart.Enable(); err != nil {
			log.Printf("auto-start register failed: %v", err)
			return
		}
		enabled := true
		cfg.AutoStart = &enabled
		if err := config.Save(configPath, *cfg); err != nil {
			log.Printf("auto-start config save failed: %v", err)
		}
		return
	}
	if *cfg.AutoStart {
		if ok, _ := autostart.Enabled(); !ok {
			if err := autostart.Enable(); err != nil {
				log.Printf("auto-start re-register failed: %v", err)
			}
		}
	}
}
