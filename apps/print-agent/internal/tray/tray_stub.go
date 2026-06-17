//go:build !windows

package tray

import "errors"

type Options struct {
	Tooltip     string
	SettingsURL string
	StatusText  func() string
	PrinterText func() string
}

func Run(Options) error {
	return errors.New("tray mode is only implemented on Windows")
}
