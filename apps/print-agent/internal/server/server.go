package server

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"hanes/print-agent/internal/config"
	"hanes/print-agent/internal/jobs"
	"hanes/print-agent/internal/printer"
)

type Server struct {
	cfg                    config.Config
	configPath             string
	effectiveListenAddress string
	backend                printer.Backend
	logger                 *jobs.Logger
	mux                    *http.ServeMux
}

type configUpdateRequest struct {
	config.Config
	ClearToken bool `json:"clearToken"`
}

func New(cfg *config.Config, backend printer.Backend) *Server {
	return NewWithConfigPath(cfg, "", backend)
}

func NewWithConfigPath(cfg *config.Config, configPath string, backend printer.Backend) *Server {
	nextCfg := config.Default()
	if cfg != nil {
		nextCfg = *cfg
	}
	nextCfg.Normalize()
	s := &Server{
		cfg:                    nextCfg,
		configPath:             configPath,
		effectiveListenAddress: nextCfg.ListenAddress,
		backend:                backend,
		logger:                 jobs.NewLogger(nextCfg.LogDir),
		mux:                    http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) ListenAndServe() error {
	return http.ListenAndServe(s.cfg.ListenAddress, s)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(s.cfg.ListenAddress, "127.0.0.1:") && r.Host != "" &&
		!strings.HasPrefix(r.Host, "127.0.0.1:") && !strings.HasPrefix(r.Host, "localhost:") {
		writeError(w, http.StatusForbidden, "localhost requests only")
		return
	}

	origin := r.Header.Get("Origin")
	if !s.cfg.IsOriginAllowed(origin) {
		writeError(w, http.StatusForbidden, "origin is not allowed")
		return
	}
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-HANES-Print-Token, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	s.mux.ServeHTTP(w, r)
}

func (s *Server) routes() {
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/printers", s.handlePrinters)
	s.mux.HandleFunc("/config", s.handleConfig)
	s.mux.HandleFunc("/settings", s.handleSettings)
	s.mux.HandleFunc("/print", s.handlePrint)
	s.mux.HandleFunc("/test-print", s.handleTestPrint)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"name":      "HANES Print Agent",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func (s *Server) handlePrinters(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	printers, err := s.backend.ListPrinters(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"printers": printers})
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.publicConfig())
	case http.MethodPost:
		if !s.authorized(r) {
			writeError(w, http.StatusUnauthorized, "invalid print agent token")
			return
		}
		var req configUpdateRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid config payload")
			return
		}
		next := req.Config
		if !req.ClearToken && strings.TrimSpace(next.Token) == "" {
			next.Token = s.cfg.Token
		}
		if req.ClearToken {
			next.Token = ""
		}
		next.Normalize()
		if s.configPath != "" {
			if err := config.Save(s.configPath, next); err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}
		s.cfg = next
		s.logger = jobs.NewLogger(next.LogDir)
		writeJSON(w, http.StatusOK, s.publicConfig())
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handlePrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !s.authorized(r) {
		writeError(w, http.StatusUnauthorized, "invalid print agent token")
		return
	}

	var req printer.PrintPNGRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, s.cfg.MaxPayloadBytes)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid print payload")
		return
	}
	req.Normalize(s.cfg.DefaultPrinter)
	if err := req.Validate(); err != nil {
		s.logger.Append(jobs.Entry{JobID: req.JobID, PrinterName: req.PrinterName, Copies: req.Copies, Status: "rejected", Error: err.Error()})
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.prepareOutputPath(&req); err != nil {
		s.logger.Append(jobs.Entry{JobID: req.JobID, PrinterName: req.PrinterName, Copies: req.Copies, Status: "rejected", Error: err.Error()})
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	result, err := s.backend.PrintPNG(r.Context(), req)
	if err != nil {
		s.logger.Append(jobs.Entry{JobID: req.JobID, PrinterName: req.PrinterName, Copies: req.Copies, Status: "failed", OutputPath: req.OutputPath, Error: err.Error()})
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.logger.Append(jobs.Entry{JobID: result.JobID, PrinterName: result.PrinterName, Copies: result.Copies, Status: result.Status, OutputPath: result.OutputPath})
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleTestPrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !s.authorized(r) {
		writeError(w, http.StatusUnauthorized, "invalid print agent token")
		return
	}
	var req printer.PrintPNGRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid test print payload")
		return
	}
	req.JobID = "HANES-TEST-PRINT"
	req.Format = "png"
	req.Copies = 1
	req.Normalize(s.cfg.DefaultPrinter)
	req.WidthMM = 60
	req.HeightMM = 40
	req.ContentBase64 = testPNGBase64()
	if err := s.prepareOutputPath(&req); err != nil {
		s.logger.Append(jobs.Entry{JobID: req.JobID, PrinterName: req.PrinterName, Copies: 1, Status: "rejected", Error: err.Error()})
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	result, err := s.backend.PrintPNG(r.Context(), req)
	if err != nil {
		s.logger.Append(jobs.Entry{JobID: req.JobID, PrinterName: req.PrinterName, Copies: 1, Status: "failed", OutputPath: req.OutputPath, Error: err.Error()})
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.logger.Append(jobs.Entry{JobID: result.JobID, PrinterName: result.PrinterName, Copies: result.Copies, Status: result.Status, OutputPath: result.OutputPath})
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) prepareOutputPath(req *printer.PrintPNGRequest) error {
	if !strings.Contains(strings.ToLower(req.PrinterName), "microsoft print to pdf") {
		return nil
	}
	if req.OutputPath == "" {
		req.OutputPath = filepath.Join(s.cfg.LogDir, "prints", sanitizeFileName(req.JobID)+".pdf")
	}
	if filepath.Ext(req.OutputPath) == "" {
		req.OutputPath += ".pdf"
	}
	return os.MkdirAll(filepath.Dir(req.OutputPath), 0o755)
}

var unsafeFileNameChars = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func sanitizeFileName(value string) string {
	value = unsafeFileNameChars.ReplaceAllString(strings.TrimSpace(value), "_")
	value = strings.Trim(value, "._-")
	if value == "" {
		return "HANES-PRINT"
	}
	return value
}

func (s *Server) authorized(r *http.Request) bool {
	if s.cfg.Token == "" {
		return true
	}
	token := strings.TrimSpace(r.Header.Get("X-HANES-Print-Token"))
	if token == "" {
		token = strings.TrimPrefix(strings.TrimSpace(r.Header.Get("Authorization")), "Bearer ")
	}
	return token == s.cfg.Token
}

func (s *Server) publicConfig() map[string]any {
	return map[string]any{
		"listenAddress":          s.cfg.ListenAddress,
		"effectiveListenAddress": s.effectiveListenAddress,
		"allowedOrigins":         s.cfg.AllowedOrigins,
		"tokenRequired":          s.cfg.Token != "",
		"defaultPrinter":         s.cfg.DefaultPrinter,
		"maxPayloadBytes":        s.cfg.MaxPayloadBytes,
		"logDir":                 s.cfg.LogDir,
		"configPath":             s.configPath,
		"restartRequired":        s.cfg.ListenAddress != s.effectiveListenAddress,
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"ok": false, "error": message})
}

func testPNGBase64() string {
	img := image.NewRGBA(image.Rect(0, 0, 480, 320))
	for y := 0; y < 320; y++ {
		for x := 0; x < 480; x++ {
			img.Set(x, y, color.White)
		}
	}
	for x := 12; x < 468; x++ {
		for w := 0; w < 6; w++ {
			img.Set(x, 12+w, color.Black)
			img.Set(x, 302+w, color.Black)
		}
	}
	for y := 12; y < 308; y++ {
		for w := 0; w < 6; w++ {
			img.Set(12+w, y, color.Black)
			img.Set(462+w, y, color.Black)
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return base64.StdEncoding.EncodeToString(buf.Bytes())
}
