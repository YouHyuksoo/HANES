//go:build !windows

package main

import (
	"log"

	"hanes/print-agent/internal/config"
	"hanes/print-agent/internal/printer"
	"hanes/print-agent/internal/server"
)

func runAgent(cfg config.Config, _ string, srv *server.Server, _ printer.Backend) error {
	log.Printf("HANES Print Agent listening on http://%s", cfg.ListenAddress)
	return srv.ListenAndServe()
}
