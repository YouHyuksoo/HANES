//go:build windows

package printer

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/draw"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"syscall"
	"unsafe"
)

const (
	printerEnumLocal       = 0x00000002
	printerEnumConnections = 0x00000004
	halftone               = 4
	dibRGBColors           = 0
	srccopy                = 0x00CC0020
	horzres                = 8
	vertres                = 10
	logPixelsX             = 88
	logPixelsY             = 90
	biRGB                  = 0
)

var (
	winspool           = syscall.NewLazyDLL("winspool.drv")
	gdi32              = syscall.NewLazyDLL("gdi32.dll")
	procEnumPrintersW  = winspool.NewProc("EnumPrintersW")
	procCreateDCW      = gdi32.NewProc("CreateDCW")
	procDeleteDC       = gdi32.NewProc("DeleteDC")
	procStartDocW      = gdi32.NewProc("StartDocW")
	procEndDoc         = gdi32.NewProc("EndDoc")
	procStartPage      = gdi32.NewProc("StartPage")
	procEndPage        = gdi32.NewProc("EndPage")
	procGetDeviceCaps  = gdi32.NewProc("GetDeviceCaps")
	procSetStretchMode = gdi32.NewProc("SetStretchBltMode")
	procStretchDIBits  = gdi32.NewProc("StretchDIBits")
)

type localPrinter struct{}

type printerInfo4 struct {
	pPrinterName *uint16
	pServerName  *uint16
	attributes   uint32
}

type docInfo struct {
	cbSize       int32
	lpszDocName  *uint16
	lpszOutput   *uint16
	lpszDatatype *uint16
	fwType       uint32
}

type bitmapInfoHeader struct {
	biSize          uint32
	biWidth         int32
	biHeight        int32
	biPlanes        uint16
	biBitCount      uint16
	biCompression   uint32
	biSizeImage     uint32
	biXPelsPerMeter int32
	biYPelsPerMeter int32
	biClrUsed       uint32
	biClrImportant  uint32
}

type bitmapInfo struct {
	header bitmapInfoHeader
	colors [3]uint32
}

func New() Backend {
	return localPrinter{}
}

func (localPrinter) ListPrinters(context.Context) ([]string, error) {
	var needed, returned uint32
	flags := uintptr(printerEnumLocal | printerEnumConnections)
	procEnumPrintersW.Call(flags, 0, 4, 0, 0, uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if needed == 0 {
		return []string{}, nil
	}

	buf := make([]byte, needed)
	ok, _, err := procEnumPrintersW.Call(
		flags,
		0,
		4,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(needed),
		uintptr(unsafe.Pointer(&needed)),
		uintptr(unsafe.Pointer(&returned)),
	)
	if ok == 0 {
		return nil, err
	}

	infos := unsafe.Slice((*printerInfo4)(unsafe.Pointer(&buf[0])), returned)
	names := make([]string, 0, returned)
	for _, info := range infos {
		if info.pPrinterName != nil {
			names = append(names, syscall.UTF16ToString(unsafe.Slice(info.pPrinterName, 256)))
		}
	}
	return names, nil
}

func (localPrinter) PrintPNG(_ context.Context, req PrintPNGRequest) (PrintResult, error) {
	req.Normalize("")
	if err := req.Validate(); err != nil {
		return PrintResult{}, err
	}

	payload, err := base64.StdEncoding.DecodeString(req.ContentBase64)
	if err != nil {
		return PrintResult{}, err
	}
	img, _, err := image.Decode(bytes.NewReader(payload))
	if err != nil {
		return PrintResult{}, err
	}
	bits, width, height := imageToBGRA(img)

	driverName, _ := syscall.UTF16PtrFromString("WINSPOOL")
	printerName, _ := syscall.UTF16PtrFromString(req.PrinterName)
	hdc, _, err := procCreateDCW.Call(
		uintptr(unsafe.Pointer(driverName)),
		uintptr(unsafe.Pointer(printerName)),
		0,
		0,
	)
	if hdc == 0 {
		return PrintResult{}, err
	}
	defer procDeleteDC.Call(hdc)

	docName, _ := syscall.UTF16PtrFromString(req.JobID)
	doc := docInfo{
		cbSize:      int32(unsafe.Sizeof(docInfo{})),
		lpszDocName: docName,
	}
	if ok, _, err := procStartDocW.Call(hdc, uintptr(unsafe.Pointer(&doc))); int32(ok) <= 0 {
		return PrintResult{}, err
	}
	defer procEndDoc.Call(hdc)

	destW, destH := targetPixels(hdc, req.WidthMM, req.HeightMM, width, height)
	for i := 0; i < req.Copies; i++ {
		if ok, _, err := procStartPage.Call(hdc); int32(ok) <= 0 {
			return PrintResult{}, err
		}
		procSetStretchMode.Call(hdc, halftone)

		bmi := bitmapInfo{
			header: bitmapInfoHeader{
				biSize:        uint32(unsafe.Sizeof(bitmapInfoHeader{})),
				biWidth:       int32(width),
				biHeight:      -int32(height),
				biPlanes:      1,
				biBitCount:    32,
				biCompression: biRGB,
				biSizeImage:   uint32(len(bits)),
			},
		}

		ok, _, err := procStretchDIBits.Call(
			hdc,
			0,
			0,
			uintptr(destW),
			uintptr(destH),
			0,
			0,
			uintptr(width),
			uintptr(height),
			uintptr(unsafe.Pointer(&bits[0])),
			uintptr(unsafe.Pointer(&bmi)),
			dibRGBColors,
			srccopy,
		)
		if int32(ok) == 0 {
			procEndPage.Call(hdc)
			return PrintResult{}, err
		}
		if ok, _, err := procEndPage.Call(hdc); int32(ok) <= 0 {
			return PrintResult{}, err
		}
	}

	return PrintResult{JobID: req.JobID, PrinterName: req.PrinterName, Copies: req.Copies, Status: "queued"}, nil
}

func imageToBGRA(src image.Image) ([]byte, int, int) {
	bounds := src.Bounds()
	rgba := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(rgba, rgba.Bounds(), image.White, image.Point{}, draw.Src)
	draw.Draw(rgba, rgba.Bounds(), src, bounds.Min, draw.Over)

	out := make([]byte, bounds.Dx()*bounds.Dy()*4)
	i := 0
	for y := 0; y < bounds.Dy(); y++ {
		for x := 0; x < bounds.Dx(); x++ {
			p := rgba.PixOffset(x, y)
			out[i+0] = rgba.Pix[p+2]
			out[i+1] = rgba.Pix[p+1]
			out[i+2] = rgba.Pix[p+0]
			out[i+3] = rgba.Pix[p+3]
			i += 4
		}
	}
	return out, bounds.Dx(), bounds.Dy()
}

func targetPixels(hdc uintptr, widthMM, heightMM float64, imageW, imageH int) (int, int) {
	if widthMM <= 0 || heightMM <= 0 {
		return imageW, imageH
	}
	dpiX := deviceCap(hdc, logPixelsX, 203)
	dpiY := deviceCap(hdc, logPixelsY, 203)
	w := int(math.Round(widthMM / 25.4 * float64(dpiX)))
	h := int(math.Round(heightMM / 25.4 * float64(dpiY)))
	maxW := deviceCap(hdc, horzres, w)
	maxH := deviceCap(hdc, vertres, h)
	if w > maxW {
		w = maxW
	}
	if h > maxH {
		h = maxH
	}
	if w <= 0 || h <= 0 {
		return imageW, imageH
	}
	return w, h
}

func deviceCap(hdc uintptr, index int, fallback int) int {
	value, _, _ := procGetDeviceCaps.Call(hdc, uintptr(index))
	if int(value) <= 0 {
		return fallback
	}
	return int(value)
}
