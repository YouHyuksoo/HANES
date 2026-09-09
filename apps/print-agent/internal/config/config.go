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
	// AutoStart 는 Windows 로그인 시 자동 실행 여부.
	// nil = 최초 실행(아직 결정 안 됨 → 기본 ON 등록), true/false = 사용자가 정한 값.
	AutoStart *bool `json:"autoStart,omitempty"`
}

func Default() Config {
	return Config{
		ListenAddress: defaultListenAddress,
		AllowedOrigins: []string{
			"http://localhost:3002",
			"http://127.0.0.1:3002",
			// 배포 서버 주소(HTTP/HTTPS 모두 등록: 실제 접속 scheme과 일치해야 CORS 통과)
			"http://hswbs.haengsung.com:3002",
			"https://hswbs.haengsung.com",
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
	// 구버전 설치본의 기본 목록(localhost만)을 사용하는 기존 사용자도
	// 재설정 없이 현재 배포 서버에서 출력할 수 있도록 알려진 origin을 보완한다.
	defaults := Default().AllowedOrigins
	seen := make(map[string]bool, len(c.AllowedOrigins))
	for _, origin := range c.AllowedOrigins {
		seen[strings.TrimRight(strings.TrimSpace(origin), "/")] = true
	}
	for _, origin := range defaults {
		if !seen[origin] {
			c.AllowedOrigins = append(c.AllowedOrigins, origin)
			seen[origin] = true
		}
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
