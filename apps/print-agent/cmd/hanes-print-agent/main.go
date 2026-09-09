package main

import (
	"log"

	"hanes/print-agent/internal/autostart"
	"hanes/print-agent/internal/browserpolicy"
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
	syncBrowserPolicy(cfg)

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

// syncBrowserPolicy 는 허용 Origin 의 https 주소를 Chrome/Edge "로컬 네트워크 접근 허용" 정책(HKCU)에 등록한다.
// https MES 페이지가 이 에이전트(127.0.0.1)에 확인창 없이 연결되게 하는 자동 설정 — 실패해도 기동은 계속한다.
func syncBrowserPolicy(cfg config.Config) {
	origins := browserpolicy.PolicyOrigins(cfg.AllowedOrigins)
	if err := browserpolicy.Sync(origins); err != nil {
		log.Printf("browser policy sync failed: %v", err)
		return
	}
	if len(origins) > 0 {
		log.Printf("browser local-network policy registered for %v", origins)
	}
}
