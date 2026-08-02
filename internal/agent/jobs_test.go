package agent

import (
	"context"
	"errors"
	"testing"
	"time"
)

func waitJob(t *testing.T, manager *JobManager, id string) BackgroundJob {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		job, ok := manager.Get(id)
		if ok && (job.Status == "success" || job.Status == "failed") {
			return job
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("job did not finish")
	return BackgroundJob{}
}

func TestJobManagerCompletesAndCapturesFailure(t *testing.T) {
	manager := NewJobManager()
	success := manager.Start("test.success", "target", func(context.Context) (any, error) {
		return map[string]string{"output": "done"}, nil
	})
	finished := waitJob(t, manager, success.ID)
	if finished.Status != "success" || len(finished.Result) == 0 {
		t.Fatalf("success job = %#v", finished)
	}
	failed := manager.Start("test.failed", "target", func(context.Context) (any, error) {
		return map[string]string{"output": "partial"}, errors.New("boom")
	})
	finished = waitJob(t, manager, failed.ID)
	if finished.Status != "failed" || finished.Error != "boom" || len(finished.Result) == 0 {
		t.Fatalf("failed job = %#v", finished)
	}
}
