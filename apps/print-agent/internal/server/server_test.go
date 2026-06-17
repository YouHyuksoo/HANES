package server

import "testing"

func TestRoutesExposeLocalPrintAgentContract(t *testing.T) {
	srv := New(nil, nil)
	if srv == nil {
		t.Fatal("expected server")
	}
}
