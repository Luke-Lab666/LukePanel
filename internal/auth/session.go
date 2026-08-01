package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"sync"
	"time"
)

type Session struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	CSRFToken string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type Store struct {
	mu       sync.RWMutex
	sessions map[string]Session
	secret   []byte
	ttl      time.Duration
}

func NewStore(secret string, ttl time.Duration) *Store {
	return &Store{sessions: make(map[string]Session), secret: []byte(secret), ttl: ttl}
}

func (s *Store) Create(username string) (token string, session Session, err error) {
	raw, err := randomBytes(32)
	if err != nil {
		return "", Session{}, err
	}
	csrf, err := randomBytes(24)
	if err != nil {
		return "", Session{}, err
	}
	id := base64.RawURLEncoding.EncodeToString(raw)
	token = id + "." + s.sign(id)
	now := time.Now()
	session = Session{ID: shortID(id), Username: username, CSRFToken: base64.RawURLEncoding.EncodeToString(csrf), CreatedAt: now, ExpiresAt: now.Add(s.ttl)}
	s.mu.Lock()
	s.sessions[id] = session
	s.mu.Unlock()
	return token, session, nil
}

func (s *Store) Get(token string) (Session, bool) {
	id, ok := s.verify(token)
	if !ok {
		return Session{}, false
	}
	s.mu.RLock()
	session, ok := s.sessions[id]
	s.mu.RUnlock()
	if !ok || time.Now().After(session.ExpiresAt) {
		if ok {
			s.Delete(token)
		}
		return Session{}, false
	}
	return session, true
}

func (s *Store) Delete(token string) {
	id, ok := s.verify(token)
	if !ok {
		return
	}
	s.mu.Lock()
	delete(s.sessions, id)
	s.mu.Unlock()
}
func (s *Store) RenameCurrentAndDeleteOthers(sessionID, username string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	revoked := 0
	for id, session := range s.sessions {
		if session.ID == sessionID {
			session.Username = username
			s.sessions[id] = session
			continue
		}
		delete(s.sessions, id)
		revoked++
	}
	return revoked
}

func (s *Store) DeleteAllExcept(sessionID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	count := 0
	for id, session := range s.sessions {
		if session.ID != sessionID {
			delete(s.sessions, id)
			count++
		}
	}
	return count
}
func (s *Store) List() []Session {
	now := time.Now()
	s.mu.RLock()
	out := make([]Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		if now.Before(session.ExpiresAt) {
			out = append(out, session)
		}
	}
	s.mu.RUnlock()
	return out
}
func (s *Store) Cleanup() {
	now := time.Now()
	s.mu.Lock()
	for id, session := range s.sessions {
		if now.After(session.ExpiresAt) {
			delete(s.sessions, id)
		}
	}
	s.mu.Unlock()
}
func (s *Store) sign(id string) string {
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(id))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func (s *Store) verify(token string) (string, bool) {
	for i := 0; i < len(token); i++ {
		if token[i] == '.' {
			id, sig := token[:i], token[i+1:]
			return id, hmac.Equal([]byte(sig), []byte(s.sign(id)))
		}
	}
	return "", false
}
func randomBytes(n int) ([]byte, error) { b := make([]byte, n); _, err := rand.Read(b); return b, err }
func shortID(id string) string {
	if len(id) > 10 {
		return id[:10]
	}
	return id
}
