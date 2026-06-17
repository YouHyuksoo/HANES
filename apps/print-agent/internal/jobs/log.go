package jobs

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Logger struct {
	dir string
	mu  sync.Mutex
}

type Entry struct {
	At          time.Time `json:"at"`
	JobID       string    `json:"jobId"`
	PrinterName string    `json:"printerName"`
	Copies      int       `json:"copies"`
	Status      string    `json:"status"`
	OutputPath  string    `json:"outputPath,omitempty"`
	Error       string    `json:"error,omitempty"`
}

func NewLogger(dir string) *Logger {
	return &Logger{dir: dir}
}

func (l *Logger) Append(entry Entry) {
	if l == nil || l.dir == "" {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	entry.At = time.Now()
	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return
	}
	path := filepath.Join(l.dir, time.Now().Format("2006-01-02")+".jsonl")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer file.Close()
	data, err := json.Marshal(entry)
	if err != nil {
		return
	}
	_, _ = file.Write(append(data, '\n'))
}
