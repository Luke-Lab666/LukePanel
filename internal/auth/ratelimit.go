package auth

import (
	"sync"
	"time"
)

type attempt struct {
	Count       int
	WindowStart time.Time
	LockedUntil time.Time
}

type LoginLimiter struct {
	mu       sync.Mutex
	attempts map[string]attempt
}

func NewLoginLimiter() *LoginLimiter { return &LoginLimiter{attempts: make(map[string]attempt)} }

func (l *LoginLimiter) Allowed(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	a := l.attempts[key]
	if time.Now().Before(a.LockedUntil) {
		return false, time.Until(a.LockedUntil)
	}
	return true, 0
}

func (l *LoginLimiter) Fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	a := l.attempts[key]
	if a.WindowStart.IsZero() || now.Sub(a.WindowStart) > 15*time.Minute {
		a = attempt{WindowStart: now}
	}
	a.Count++
	if a.Count >= 5 {
		a.LockedUntil = now.Add(15 * time.Minute)
	}
	l.attempts[key] = a
}

func (l *LoginLimiter) Success(key string) {
	l.mu.Lock()
	delete(l.attempts, key)
	l.mu.Unlock()
}
