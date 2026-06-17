//go:build windows

package tray

import (
	"errors"
	"syscall"
	"unsafe"
)

type Options struct {
	Tooltip     string
	SettingsURL string
	StatusText  func() string
	PrinterText func() string
}

const (
	wmDestroy       = 0x0002
	wmCommand       = 0x0111
	wmRButtonUp     = 0x0205
	wmLButtonDblClk = 0x0203
	wmAppTray       = 0x8001

	nimAdd     = 0x00000000
	nimDelete  = 0x00000002
	nifMessage = 0x00000001
	nifIcon    = 0x00000002
	nifTip     = 0x00000004

	idiApplication = 32512
	imageIcon      = 1
	lrShared       = 0x00008000

	mfString = 0x00000000
	mfSep    = 0x00000800

	tpmRightButton = 0x0002
	tpmReturnCmd   = 0x0100

	cmdStatus   = 1001
	cmdPrinters = 1002
	cmdSettings = 1003
	cmdExit     = 1004
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")

	procRegisterClassExW    = user32.NewProc("RegisterClassExW")
	procCreateWindowExW     = user32.NewProc("CreateWindowExW")
	procDefWindowProcW      = user32.NewProc("DefWindowProcW")
	procDestroyWindow       = user32.NewProc("DestroyWindow")
	procGetMessageW         = user32.NewProc("GetMessageW")
	procTranslateMessage    = user32.NewProc("TranslateMessage")
	procDispatchMessageW    = user32.NewProc("DispatchMessageW")
	procPostQuitMessage     = user32.NewProc("PostQuitMessage")
	procCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	procAppendMenuW         = user32.NewProc("AppendMenuW")
	procDestroyMenu         = user32.NewProc("DestroyMenu")
	procTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procGetCursorPos        = user32.NewProc("GetCursorPos")
	procMessageBoxW         = user32.NewProc("MessageBoxW")
	procLoadImageW          = user32.NewProc("LoadImageW")

	procShellNotifyIconW = shell32.NewProc("Shell_NotifyIconW")
	procShellExecuteW    = shell32.NewProc("ShellExecuteW")
	procGetModuleHandleW = kernel32.NewProc("GetModuleHandleW")

	current *app
)

type app struct {
	options Options
	hwnd    uintptr
	icon    uintptr
}

type wndClassEx struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     uintptr
	hIcon         uintptr
	hCursor       uintptr
	hbrBackground uintptr
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       uintptr
}

type point struct {
	x int32
	y int32
}

type msg struct {
	hwnd    uintptr
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      point
}

type notifyIconData struct {
	cbSize           uint32
	hWnd             uintptr
	uID              uint32
	uFlags           uint32
	uCallbackMessage uint32
	hIcon            uintptr
	szTip            [128]uint16
	dwState          uint32
	dwStateMask      uint32
	szInfo           [256]uint16
	uVersion         uint32
	szInfoTitle      [64]uint16
	dwInfoFlags      uint32
	guidItem         [16]byte
	hBalloonIcon     uintptr
}

func Run(options Options) error {
	a := &app{options: options}
	current = a

	hInstance, _, _ := procGetModuleHandleW.Call(0)
	className := utf16Ptr("HANESPrintAgentTrayWindow")
	wc := wndClassEx{
		cbSize:        uint32(unsafe.Sizeof(wndClassEx{})),
		lpfnWndProc:   syscall.NewCallback(wndProc),
		hInstance:     hInstance,
		lpszClassName: className,
	}
	if atom, _, err := procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc))); atom == 0 {
		return err
	}

	hwnd, _, err := procCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(utf16Ptr("HANES Print Agent"))),
		0,
		0, 0, 0, 0,
		0, 0, hInstance, 0,
	)
	if hwnd == 0 {
		return err
	}
	a.hwnd = hwnd
	a.icon, _, _ = procLoadImageW.Call(0, idiApplication, imageIcon, 0, 0, lrShared)

	if err := a.addIcon(); err != nil {
		return err
	}
	defer a.deleteIcon()

	var m msg
	for {
		ret, _, err := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(ret) == -1 {
			return err
		}
		if ret == 0 {
			return nil
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

func wndProc(hwnd uintptr, message uint32, wParam, lParam uintptr) uintptr {
	if current == nil {
		ret, _, _ := procDefWindowProcW.Call(hwnd, uintptr(message), wParam, lParam)
		return ret
	}

	switch message {
	case wmAppTray:
		switch uint32(lParam) {
		case wmRButtonUp:
			current.showMenu()
			return 0
		case wmLButtonDblClk:
			current.showStatus()
			return 0
		}
	case wmCommand:
		current.handleCommand(uint16(wParam & 0xffff))
		return 0
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	}

	ret, _, _ := procDefWindowProcW.Call(hwnd, uintptr(message), wParam, lParam)
	return ret
}

func (a *app) addIcon() error {
	nid := notifyIconData{
		cbSize:           uint32(unsafe.Sizeof(notifyIconData{})),
		hWnd:             a.hwnd,
		uID:              1,
		uFlags:           nifMessage | nifIcon | nifTip,
		uCallbackMessage: wmAppTray,
		hIcon:            a.icon,
	}
	copy(nid.szTip[:], utf16Slice(a.options.Tooltip, len(nid.szTip)))
	if ok, _, err := procShellNotifyIconW.Call(nimAdd, uintptr(unsafe.Pointer(&nid))); ok == 0 {
		if err != syscall.Errno(0) {
			return err
		}
		return errors.New("Shell_NotifyIconW add failed")
	}
	return nil
}

func (a *app) deleteIcon() {
	nid := notifyIconData{
		cbSize: uint32(unsafe.Sizeof(notifyIconData{})),
		hWnd:   a.hwnd,
		uID:    1,
	}
	procShellNotifyIconW.Call(nimDelete, uintptr(unsafe.Pointer(&nid)))
}

func (a *app) showMenu() {
	menu, _, _ := procCreatePopupMenu.Call()
	if menu == 0 {
		return
	}
	defer procDestroyMenu.Call(menu)

	appendMenu(menu, mfString, cmdStatus, "상태 보기")
	appendMenu(menu, mfString, cmdSettings, "설정")
	appendMenu(menu, mfString, cmdPrinters, "프린터 보기")
	appendMenu(menu, mfSep, 0, "")
	appendMenu(menu, mfString, cmdExit, "종료")

	var pt point
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	procSetForegroundWindow.Call(a.hwnd)
	cmd, _, _ := procTrackPopupMenu.Call(menu, tpmRightButton|tpmReturnCmd, uintptr(pt.x), uintptr(pt.y), 0, a.hwnd, 0)
	if cmd != 0 {
		a.handleCommand(uint16(cmd))
	}
}

func (a *app) handleCommand(command uint16) {
	switch command {
	case cmdStatus:
		a.showStatus()
	case cmdPrinters:
		text := "프린터 목록 조회 함수가 설정되지 않았습니다."
		if a.options.PrinterText != nil {
			text = a.options.PrinterText()
		}
		messageBox(a.hwnd, "프린터 보기", text)
	case cmdSettings:
		if a.options.SettingsURL == "" {
			messageBox(a.hwnd, "설정", "설정 화면 URL이 지정되지 않았습니다.")
			return
		}
		if err := openURL(a.options.SettingsURL); err != nil {
			messageBox(a.hwnd, "설정", "설정 화면을 열지 못했습니다.\n"+err.Error())
		}
	case cmdExit:
		procDestroyWindow.Call(a.hwnd)
	}
}

func (a *app) showStatus() {
	text := "HANES Print Agent 실행 중"
	if a.options.StatusText != nil {
		text = a.options.StatusText()
	}
	messageBox(a.hwnd, "상태 보기", text)
}

func appendMenu(menu uintptr, flags uintptr, id uintptr, text string) {
	var p uintptr
	if text != "" {
		p = uintptr(unsafe.Pointer(utf16Ptr(text)))
	}
	procAppendMenuW.Call(menu, flags, id, p)
}

func messageBox(hwnd uintptr, title, text string) {
	procMessageBoxW.Call(
		hwnd,
		uintptr(unsafe.Pointer(utf16Ptr(text))),
		uintptr(unsafe.Pointer(utf16Ptr(title))),
		0,
	)
}

func openURL(url string) error {
	verb := utf16Ptr("open")
	target := utf16Ptr(url)
	ret, _, err := procShellExecuteW.Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(target)), 0, 0, 1)
	if ret <= 32 {
		return err
	}
	return nil
}

func utf16Ptr(value string) *uint16 {
	ptr, _ := syscall.UTF16PtrFromString(value)
	return ptr
}

func utf16Slice(value string, max int) []uint16 {
	raw := syscall.StringToUTF16(value)
	if len(raw) > max {
		raw = raw[:max]
		raw[max-1] = 0
	}
	return raw
}
