package printer

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

type Backend interface {
	ListPrinters(context.Context) ([]string, error)
	PrintPNG(context.Context, PrintPNGRequest) (PrintResult, error)
}

type PrintPNGRequest struct {
	JobID         string  `json:"jobId"`
	PrinterName   string  `json:"printerName"`
	Format        string  `json:"format"`
	WidthMM       float64 `json:"widthMm"`
	HeightMM      float64 `json:"heightMm"`
	Copies        int     `json:"copies"`
	ContentBase64 string  `json:"contentBase64"`
	OutputPath    string  `json:"outputPath,omitempty"`
}

type PrintResult struct {
	JobID       string `json:"jobId"`
	PrinterName string `json:"printerName"`
	Copies      int    `json:"copies"`
	Status      string `json:"status"`
	OutputPath  string `json:"outputPath,omitempty"`
}

func (r *PrintPNGRequest) Normalize(defaultPrinter string) {
	r.JobID = strings.TrimSpace(r.JobID)
	r.PrinterName = strings.TrimSpace(r.PrinterName)
	r.Format = strings.ToLower(strings.TrimSpace(r.Format))
	r.OutputPath = strings.TrimSpace(r.OutputPath)
	if r.Format == "" {
		r.Format = "png"
	}
	if r.PrinterName == "" {
		r.PrinterName = strings.TrimSpace(defaultPrinter)
	}
	if r.Copies <= 0 {
		r.Copies = 1
	}
}

func (r PrintPNGRequest) Validate() error {
	if r.JobID == "" {
		return errors.New("jobId is required")
	}
	if r.PrinterName == "" {
		return errors.New("printerName or defaultPrinter is required")
	}
	if r.Format != "png" {
		return fmt.Errorf("unsupported format %q", r.Format)
	}
	if strings.TrimSpace(r.ContentBase64) == "" {
		return errors.New("contentBase64 is required")
	}
	if _, err := base64.StdEncoding.DecodeString(r.ContentBase64); err != nil {
		return fmt.Errorf("contentBase64 is not valid base64: %w", err)
	}
	if r.Copies > 50 {
		return errors.New("copies must be 50 or less")
	}
	if r.WidthMM < 0 || r.HeightMM < 0 {
		return errors.New("widthMm and heightMm cannot be negative")
	}
	return nil
}
