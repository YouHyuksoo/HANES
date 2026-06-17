package printer

import "testing"

func TestPNGPrintRequestValidationRejectsEmptyPayload(t *testing.T) {
	req := PrintPNGRequest{JobID: "test"}
	if err := req.Validate(); err == nil {
		t.Fatal("expected empty content validation error")
	}
}
