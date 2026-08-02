package server

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPTrustsLoopbackReverseProxy(t *testing.T) {
	r := httptest.NewRequest("GET", "http://example.test", nil)
	r.RemoteAddr = "127.0.0.1:4567"
	r.Header.Set("X-Real-IP", "203.0.113.7")
	if got := clientIP(r, ""); got != "203.0.113.7" {
		t.Fatalf("clientIP = %q", got)
	}
}

func TestClientIPRejectsForwardedHeaderFromUntrustedSource(t *testing.T) {
	r := httptest.NewRequest("GET", "http://example.test", nil)
	r.RemoteAddr = "198.51.100.9:4567"
	r.Header.Set("X-Real-IP", "203.0.113.7")
	if got := clientIP(r, ""); got != "198.51.100.9" {
		t.Fatalf("clientIP = %q", got)
	}
}

func TestClientIPTrustedCIDRAndLastForwardedAddress(t *testing.T) {
	r := httptest.NewRequest("GET", "http://example.test", nil)
	r.RemoteAddr = "172.18.0.4:4567"
	r.Header.Set("X-Forwarded-For", "192.0.2.66, 203.0.113.8")
	if got := clientIP(r, "172.18.0.0/16"); got != "203.0.113.8" {
		t.Fatalf("clientIP = %q", got)
	}
}
