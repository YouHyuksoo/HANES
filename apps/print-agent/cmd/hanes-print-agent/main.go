package main

import (
	"log"

	"hanes/print-agent/internal/config"
	"hanes/print-agent/internal/printer"
	"hanes/print-agent/internal/server"
)

func main() {
	cfg, configPath, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	backend := printer.New()
	srv := server.NewWithConfigPath(&cfg, configPath, backend)
	if err := runAgent(cfg, srv, backend); err != nil {
		log.Fatal(err)
	}
}
