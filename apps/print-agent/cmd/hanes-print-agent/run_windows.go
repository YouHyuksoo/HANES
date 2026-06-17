//go:build windows

package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"hanes/print-agent/internal/config"
	"hanes/print-agent/internal/printer"
	"hanes/print-agent/internal/server"
	"hanes/print-agent/internal/tray"
)

func runAgent(cfg config.Config, srv *server.Server, backend printer.Backend) error {
	httpServer := &http.Server{
		Addr:              cfg.ListenAddress,
		Handler:           srv,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	trayErr := make(chan error, 1)
	go func() {
		trayErr <- tray.Run(tray.Options{
			Tooltip:     fmt.Sprintf("HANES Print Agent - %s", cfg.ListenAddress),
			SettingsURL: fmt.Sprintf("http://%s/settings", cfg.ListenAddress),
			StatusText: func() string {
				return fmt.Sprintf("HANES Print Agent 실행 중\n주소: http://%s\n설정: http://%s/settings", cfg.ListenAddress, cfg.ListenAddress)
			},
			PrinterText: func() string {
				printers, err := backend.ListPrinters(context.Background())
				if err != nil {
					return "프린터 목록 조회 실패:\n" + err.Error()
				}
				if len(printers) == 0 {
					return "등록된 Windows 프린터가 없습니다."
				}
				return "등록된 프린터:\n- " + strings.Join(printers, "\n- ")
			},
		})
	}()

	select {
	case err := <-errCh:
		return err
	case err := <-trayErr:
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(ctx)
		return err
	}
}
