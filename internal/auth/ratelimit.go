package auth

import (
	"sort"
	"sync"
	"time"
)

const maxLoginLimiterKeys = 4096

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
	now := time.Now()
	l.pruneLocked(now)
	a := l.attempts[key]
	if now.Before(a.LockedUntil) {
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
	l.pruneLocked(now)
}

func (l *LoginLimiter) Success(key string) {
	l.mu.Lock()
	delete(l.attempts, key)
	l.mu.Unlock()
}

func (l *LoginLimiter) pruneLocked(now time.Time) {
	for key, item := range l.attempts {
		if now.After(item.LockedUntil) && !item.WindowStart.IsZero() && now.Sub(item.WindowStart) > 30*time.Minute {
			delete(l.attempts, key)
		}
	}
	if len(l.attempts) <= maxLoginLimiterKeys {
		return
	}
	type candidate struct {
		key  string
		seen time.Time
	}
	items := make([]candidate, 0, len(l.attempts))
	for key, item := range l.attempts {
		seen := item.WindowStart
		if item.LockedUntil.After(seen) {
			seen = item.LockedUntil
		}
		items = append(items, candidate{key: key, seen: seen})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].seen.Before(items[j].seen) })
	for index := 0; index < len(items)-maxLoginLimiterKeys; index++ {
		delete(l.attempts, items[index].key)
	}
}
