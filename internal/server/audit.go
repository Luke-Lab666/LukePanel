package server

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type AuditEvent struct {
	Time   string `json:"time"`
	IP     string `json:"ip"`
	User   string `json:"user"`
	Action string `json:"action"`
	Target string `json:"target,omitempty"`
	Result string `json:"result"`
	Detail string `json:"detail,omitempty"`
}

type AuditLog struct {
	mu   sync.Mutex
	path string
}

func NewAuditLog(dataDir string) *AuditLog {
	return &AuditLog{path: filepath.Join(dataDir, "audit.jsonl")}
}
func (a *AuditLog) Write(event AuditEvent) {
	a.mu.Lock()
	defer a.mu.Unlock()
	_ = os.MkdirAll(filepath.Dir(a.path), 0o750)
	f, err := os.OpenFile(a.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	event.Time = time.Now().UTC().Format(time.RFC3339Nano)
	_ = json.NewEncoder(f).Encode(event)
}
func (a *AuditLog) Read(limit int) ([]AuditEvent, error) {
	if limit < 1 || limit > 2000 {
		limit = 300
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	f, err := os.Open(a.path)
	if os.IsNotExist(err) {
		return []AuditEvent{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()
	events := make([]AuditEvent, 0, limit)
	s := bufio.NewScanner(f)
	buf := make([]byte, 64<<10)
	s.Buffer(buf, 1<<20)
	for s.Scan() {
		var event AuditEvent
		if json.Unmarshal(s.Bytes(), &event) == nil {
			if len(events) == limit {
				copy(events, events[1:])
				events[len(events)-1] = event
			} else {
				events = append(events, event)
			}
		}
	}
	if err := s.Err(); err != nil {
		return nil, err
	}
	for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
		events[i], events[j] = events[j], events[i]
	}
	return events, nil
}
