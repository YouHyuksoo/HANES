package browserpolicy

import "strings"

func splitLines(s string) []string {
	return strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n")
}

func containsFold(s, sub string) bool {
	return strings.Contains(strings.ToUpper(s), strings.ToUpper(sub))
}
