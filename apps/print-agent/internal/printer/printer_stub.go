//go:build !windows

package printer

import (
	"context"
	"errors"
)

type localPrinter struct{}

func New() Backend {
	return localPrinter{}
}

func (localPrinter) ListPrinters(context.Context) ([]string, error) {
	return []string{}, errors.New("printer discovery is only implemented on Windows")
}

func (localPrinter) PrintPNG(context.Context, PrintPNGRequest) (PrintResult, error) {
	return PrintResult{}, errors.New("PNG printing is only implemented on Windows")
}
