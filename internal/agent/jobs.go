package agent

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"sort"
	"sync"
	"time"
)

const maxBackgroundJobs = 40

type BackgroundJob struct {
	ID         string          `json:"id"`
	Kind       string          `json:"kind"`
	Target     string          `json:"target,omitempty"`
	Status     string          `json:"status"`
	CreatedAt  time.Time       `json:"created_at"`
	StartedAt  time.Time       `json:"started_at,omitempty"`
	FinishedAt time.Time       `json:"finished_at,omitempty"`
	Result     json.RawMessage `json:"result,omitempty"`
	Error      string          `json:"error,omitempty"`
}

type JobManager struct {
	mu   sync.RWMutex
	jobs map[string]BackgroundJob
}

func NewJobManager() *JobManager { return &JobManager{jobs: make(map[string]BackgroundJob)} }

func (m *JobManager) Start(kind, target string, fn func(context.Context) (any, error)) BackgroundJob {
	idBytes := make([]byte, 8)
	_, _ = rand.Read(idBytes)
	job := BackgroundJob{ID: hex.EncodeToString(idBytes), Kind: kind, Target: target, Status: "queued", CreatedAt: time.Now().UTC()}
	m.mu.Lock()
	m.pruneLocked()
	m.jobs[job.ID] = job
	m.mu.Unlock()
	go func() {
		m.update(job.ID, func(current *BackgroundJob) {
			current.Status = "running"
			current.StartedAt = time.Now().UTC()
		})
		result, err := fn(context.Background())
		raw, _ := json.Marshal(result)
		m.update(job.ID, func(current *BackgroundJob) {
			current.FinishedAt = time.Now().UTC()
			current.Result = raw
			if err != nil {
				current.Status = "failed"
				current.Error = err.Error()
			} else {
				current.Status = "success"
			}
		})
	}()
	return job
}

func (m *JobManager) Get(id string) (BackgroundJob, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	job, ok := m.jobs[id]
	return job, ok
}

func (m *JobManager) List() []BackgroundJob {
	m.mu.RLock()
	items := make([]BackgroundJob, 0, len(m.jobs))
	for _, job := range m.jobs {
		items = append(items, job)
	}
	m.mu.RUnlock()
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	return items
}

func (m *JobManager) update(id string, fn func(*BackgroundJob)) {
	m.mu.Lock()
	job, ok := m.jobs[id]
	if ok {
		fn(&job)
		m.jobs[id] = job
	}
	m.mu.Unlock()
}

func (m *JobManager) pruneLocked() {
	if len(m.jobs) < maxBackgroundJobs {
		return
	}
	items := make([]BackgroundJob, 0, len(m.jobs))
	for _, job := range m.jobs {
		items = append(items, job)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.Before(items[j].CreatedAt) })
	remove := len(items) - maxBackgroundJobs + 1
	for _, job := range items {
		if remove <= 0 {
			break
		}
		if job.Status == "running" || job.Status == "queued" {
			continue
		}
		delete(m.jobs, job.ID)
		remove--
	}
}
