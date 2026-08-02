package agent

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestDecodeErrorPreservesStatus(t *testing.T) {
	resp := &http.Response{StatusCode: http.StatusForbidden, Status: "403 Forbidden", Body: io.NopCloser(strings.NewReader(`{"error":"需要二次验证"}`))}
	err := decodeError(resp)
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("error type = %T", err)
	}
	if httpErr.StatusCode != http.StatusForbidden || httpErr.Error() != "需要二次验证" {
		t.Fatalf("error = %#v", httpErr)
	}
}
