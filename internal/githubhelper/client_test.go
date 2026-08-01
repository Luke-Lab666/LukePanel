package githubhelper

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	for _, value := range []string{"v0.6.0-alpha", "v1.0.0"} {
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

func TestExtractGitHubArchiveStripsRootAndSkipsGit(t *testing.T) {
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	for name, content := range map[string]string{
		"LukePanel-main/README.md":   "hello",
		"LukePanel-main/web/app.js":  "console.log('ok')",
		"LukePanel-main/.git/config": "skip",
	} {
		file, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = file.Write([]byte(content))
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	files, skipped, _, err := extractGitHubArchive(bytes.NewReader(archive.Bytes()), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := files["README.md"]; !ok {
		t.Fatalf("root folder was not stripped: %#v", files)
	}
	if _, ok := files["web/app.js"]; !ok {
		t.Fatalf("nested file missing: %#v", files)
	}
	if skipped != 1 {
		t.Fatalf("skipped = %d", skipped)
	}
}

func TestNormalizeArchivePathRejectsTraversal(t *testing.T) {
	if _, _, err := normalizeArchivePath("../secret", ""); err == nil {
		t.Fatal("expected traversal error")
	}
}

func TestDeviceFlow(t *testing.T) {
	var polls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/login/device/code":
			_ = json.NewEncoder(w).Encode(map[string]any{"device_code": "device", "user_code": "ABCD-EFGH", "verification_uri": "https://github.example/device", "expires_in": 900, "interval": 5})
		case "/login/oauth/access_token":
			polls++
			if polls == 1 {
				_ = json.NewEncoder(w).Encode(map[string]any{"error": "authorization_pending"})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "token", "token_type": "bearer", "scope": "repo workflow read:user"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	client := New()
	client.webBase = server.URL
	device, err := client.StartDeviceFlow(context.Background(), "Ov23li12345678901234", "repo")
	if err != nil || device.UserCode != "ABCD-EFGH" {
		t.Fatalf("device=%#v err=%v", device, err)
	}
	first, err := client.PollDeviceFlow(context.Background(), "Ov23li12345678901234", device.DeviceCode)
	if err != nil || first.Status != "pending" {
		t.Fatalf("first=%#v err=%v", first, err)
	}
	second, err := client.PollDeviceFlow(context.Background(), "Ov23li12345678901234", device.DeviceCode)
	if err != nil || second.Status != "authorized" || second.AccessToken != "token" {
		t.Fatalf("second=%#v err=%v", second, err)
	}
}

func TestListAndMergePullRequests(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/repos/Luke-Lab666/LukePanel/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{{
				"number": 7, "title": "Update", "state": "open", "html_url": "https://example/pr/7", "draft": false,
				"head": map[string]any{"ref": "agent/update", "sha": "0123456789abcdef"}, "base": map[string]any{"ref": "main"},
			}})
		case r.Method == http.MethodPut && r.URL.Path == "/repos/Luke-Lab666/LukePanel/pulls/7/merge":
			var payload map[string]any
			_ = json.NewDecoder(r.Body).Decode(&payload)
			if payload["merge_method"] != "squash" || payload["sha"] != "0123456789abcdef" {
				t.Fatalf("payload = %#v", payload)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"sha": "mergedsha", "merged": true, "message": "Pull Request successfully merged"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	client := New()
	client.apiBase = server.URL
	pulls, err := client.ListPullRequests(context.Background(), "Luke-Lab666", "LukePanel", "token")
	if err != nil || len(pulls) != 1 || pulls[0].HeadSHA != "0123456789abcdef" {
		t.Fatalf("pulls=%#v err=%v", pulls, err)
	}
	merged, err := client.MergePullRequest(context.Background(), "Luke-Lab666", "LukePanel", 7, pulls[0].HeadSHA, "squash", "token")
	if err != nil || !merged.Merged {
		t.Fatalf("merge=%#v err=%v", merged, err)
	}
}
