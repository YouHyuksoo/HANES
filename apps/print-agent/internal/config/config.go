package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

const (
	defaultListenAddress = "127.0.0.1:37111"
	defaultMaxPayload    = int64(12 * 1024 * 1024)
)

type Config struct {
	ListenAddress   string   `json:"listenAddress"`
	AllowedOrigins  []string `json:"allowedOrigins"`
	Token           string   `json:"token"`
	DefaultPrinter  string   `json:"defaultPrinter"`
	MaxPayloadBytes int64    `json:"maxPayloadBytes"`
	LogDir          string   `json:"logDir"`
}

func Default() Config {
	return Config{
		ListenAddress: defaultListenAddress,
		AllowedOrigins: []string{
			"http://localhost:3002",
			"http://127.0.0.1:3002",
		},
		MaxPayloadBytes: defaultMaxPayload,
	}
}

func Load() (Config, string, error) {
	path, err := Path()
	if err != nil {
		return Config{}, "", err
	}

	cfg := Default()
	if data, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(data, &cfg); err != nil {
			return Config{}, path, err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return Config{}, path, err
	}

	cfg.Normalize()
	if envToken := strings.TrimSpace(os.Getenv("HANES_PRINT_AGENT_TOKEN")); envToken != "" {
		cfg.Token = envToken
	}
	if envOrigins := strings.TrimSpace(os.Getenv("HANES_PRINT_AGENT_ORIGINS")); envOrigins != "" {
		cfg.AllowedOrigins = splitCSV(envOrigins)
	}
	return cfg, path, nil
}

func Save(path string, cfg Config) error {
	cfg.Normalize()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

func Path() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "HANES", "print-agent", "config.json"), nil
}

func DefaultLogDir() string {
	base, err := os.UserConfigDir()
	if err != nil {
		return "logs"
	}
	return filepath.Join(base, "HANES", "print-agent", "logs")
}

func (c *Config) Normalize() {
	if strings.TrimSpace(c.ListenAddress) == "" {
		c.ListenAddress = defaultListenAddress
	}
	if c.ListenAddress == ":37111" || strings.HasPrefix(c.ListenAddress, "0.0.0.0:") {
		c.ListenAddress = defaultListenAddress
	}
	if c.MaxPayloadBytes <= 0 {
		c.MaxPayloadBytes = defaultMaxPayload
	}
	if strings.TrimSpace(c.LogDir) == "" {
		c.LogDir = DefaultLogDir()
	}
	if len(c.AllowedOrigins) == 0 {
		c.AllowedOrigins = Default().AllowedOrigins
	}
	for i := range c.AllowedOrigins {
		c.AllowedOrigins[i] = strings.TrimRight(strings.TrimSpace(c.AllowedOrigins[i]), "/")
	}
	c.Token = strings.TrimSpace(c.Token)
	c.DefaultPrinter = strings.TrimSpace(c.DefaultPrinter)
}

func (c Config) IsOriginAllowed(origin string) bool {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" {
		return true
	}
	for _, allowed := range c.AllowedOrigins {
		if allowed == "*" || strings.EqualFold(allowed, origin) {
			return true
		}
	}
	return false
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}
