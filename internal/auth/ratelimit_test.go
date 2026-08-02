package auth

import "testing"

func TestLoginLimiterLocksAfterFiveFailures(t *testing.T) {
	limiter := NewLoginLimiter()
	for index := 0; index < 5; index++ {
		limiter.Fail("192.0.2.1")
	}
	if allowed, _ := limiter.Allowed("192.0.2.1"); allowed {
		t.Fatal("limiter did not lock after five failures")
	}
	limiter.Success("192.0.2.1")
	if allowed, _ := limiter.Allowed("192.0.2.1"); !allowed {
		t.Fatal("successful login did not clear limiter state")
	}
}

func TestLoginLimiterCapsTrackedKeys(t *testing.T) {
	limiter := NewLoginLimiter()
	for index := 0; index < maxLoginLimiterKeys+256; index++ {
		limiter.Fail(string(rune(index + 1)))
	}
	limiter.mu.Lock()
	count := len(limiter.attempts)
	limiter.mu.Unlock()
	if count > maxLoginLimiterKeys {
		t.Fatalf("tracked keys = %d, want <= %d", count, maxLoginLimiterKeys)
	}
}
