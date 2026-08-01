package githubhelper

import (
	"context"
	"testing"
)

func TestValidateRepoAndTag(t *testing.T) {
	if err := validateRepo("Luke-Lab666", "LukePanel"); err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"", "../x", "owner/name"} {
		if err := validateRepo(value, "repo"); err == nil {
			t.Fatalf("owner %q accepted", value)
		}
	}
	for _, value := range []string{"v0.3.0-alpha", "v1.0.0"} {
		if !tagPattern.MatchString(value) {
			t.Fatalf("tag %q rejected", value)
		}
	}
	for _, value := range []string{"V1.0", "1.0", "v bad"} {
		if tagPattern.MatchString(value) {
			t.Fatalf("tag %q accepted", value)
		}
	}
}

func TestRerunFailedJobsValidatesInput(t *testing.T) {
	client := New()
	if err := client.RerunFailedJobs(context.Background(), "Luke-Lab666", "LukePanel", 0, "token"); err == nil {
		t.Fatal("expected invalid run id")
	}
	if err := client.RerunFailedJobs(context.Background(), "Luke-Lab666", "LukePanel", 1, ""); err == nil {
		t.Fatal("expected missing token")
	}
}
