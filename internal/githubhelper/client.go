package githubhelper

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var (
	ownerPattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`)
	repoPattern  = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
	tagPattern   = regexp.MustCompile(`^v[0-9][A-Za-z0-9._-]{0,63}$`)
)

type Client struct {
	http *http.Client
}

type RepositorySummary struct {
	Owner         string        `json:"owner"`
	Name          string        `json:"name"`
	FullName      string        `json:"full_name"`
	Description   string        `json:"description"`
	Visibility    string        `json:"visibility"`
	DefaultBranch string        `json:"default_branch"`
	UpdatedAt     string        `json:"updated_at"`
	MainSHA       string        `json:"main_sha"`
	Tags          []Tag         `json:"tags"`
	LatestRelease *Release      `json:"latest_release,omitempty"`
	WorkflowRuns  []WorkflowRun `json:"workflow_runs"`
}

type Tag struct {
	Name string `json:"name"`
	SHA  string `json:"sha"`
}

type Release struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`
	Draft       bool   `json:"draft"`
	Prerelease  bool   `json:"prerelease"`
}

type WorkflowRun struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Event      string `json:"event"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
	HeadBranch string `json:"head_branch"`
	HeadSHA    string `json:"head_sha"`
	CreatedAt  string `json:"created_at"`
	HTMLURL    string `json:"html_url"`
}

func New() *Client {
	return &Client{http: &http.Client{Timeout: 15 * time.Second}}
}

func (c *Client) Summary(ctx context.Context, owner, repo, token string) (RepositorySummary, error) {
	if err := validateRepo(owner, repo); err != nil {
		return RepositorySummary{}, err
	}
	var metadata struct {
		FullName      string `json:"full_name"`
		Description   string `json:"description"`
		Visibility    string `json:"visibility"`
		Private       bool   `json:"private"`
		DefaultBranch string `json:"default_branch"`
		UpdatedAt     string `json:"updated_at"`
	}
	if err := c.get(ctx, owner, repo, "", token, &metadata); err != nil {
		return RepositorySummary{}, err
	}
	if metadata.Visibility == "" {
		if metadata.Private {
			metadata.Visibility = "private"
		} else {
			metadata.Visibility = "public"
		}
	}
	var branch struct {
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	_ = c.get(ctx, owner, repo, "/branches/"+url.PathEscape(metadata.DefaultBranch), token, &branch)
	var rawTags []struct {
		Name   string `json:"name"`
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	_ = c.get(ctx, owner, repo, "/tags?per_page=10", token, &rawTags)
	tags := make([]Tag, 0, len(rawTags))
	for _, item := range rawTags {
		tags = append(tags, Tag{Name: item.Name, SHA: item.Commit.SHA})
	}
	var latest Release
	var latestPtr *Release
	if err := c.get(ctx, owner, repo, "/releases/latest", token, &latest); err == nil {
		latestPtr = &latest
	}
	var runs struct {
		WorkflowRuns []WorkflowRun `json:"workflow_runs"`
	}
	_ = c.get(ctx, owner, repo, "/actions/runs?per_page=10", token, &runs)
	return RepositorySummary{Owner: owner, Name: repo, FullName: metadata.FullName, Description: metadata.Description, Visibility: metadata.Visibility, DefaultBranch: metadata.DefaultBranch, UpdatedAt: metadata.UpdatedAt, MainSHA: branch.Commit.SHA, Tags: tags, LatestRelease: latestPtr, WorkflowRuns: runs.WorkflowRuns}, nil
}

func (c *Client) CreateTag(ctx context.Context, owner, repo, tag, targetSHA, token string) error {
	if err := validateRepo(owner, repo); err != nil {
		return err
	}
	if !tagPattern.MatchString(tag) {
		return errors.New("版本号必须以小写 v 开头，例如 v0.3.0-alpha")
	}
	if strings.TrimSpace(token) == "" {
		return errors.New("需要一次性 GitHub Token")
	}
	if targetSHA == "" {
		summary, err := c.Summary(ctx, owner, repo, token)
		if err != nil {
			return err
		}
		targetSHA = summary.MainSHA
	}
	if len(targetSHA) < 7 || len(targetSHA) > 64 {
		return errors.New("目标提交 SHA 无效")
	}
	payload := map[string]string{"ref": "refs/tags/" + tag, "sha": targetSHA}
	return c.requestJSON(ctx, http.MethodPost, owner, repo, "/git/refs", token, payload, nil)
}

func (c *Client) RerunFailedJobs(ctx context.Context, owner, repo string, runID int64, token string) error {
	if err := validateRepo(owner, repo); err != nil {
		return err
	}
	if runID <= 0 {
		return errors.New("Actions 运行编号无效")
	}
	if strings.TrimSpace(token) == "" {
		return errors.New("需要一次性 GitHub Token")
	}
	return c.requestJSON(ctx, http.MethodPost, owner, repo, fmt.Sprintf("/actions/runs/%d/rerun-failed-jobs", runID), token, nil, nil)
}

func (c *Client) get(ctx context.Context, owner, repo, suffix, token string, out any) error {
	return c.requestJSON(ctx, http.MethodGet, owner, repo, suffix, token, nil, out)
}

func (c *Client) requestJSON(ctx context.Context, method, owner, repo, suffix, token string, body, out any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	endpoint := fmt.Sprintf("https://api.github.com/repos/%s/%s%s", url.PathEscape(owner), url.PathEscape(repo), suffix)
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "LukePanel-GitHub-Helper")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 GitHub API，请检查服务器 DNS 和网络：%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 128<<10))
		var payload struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(data, &payload) == nil && payload.Message != "" {
			if resp.StatusCode == http.StatusNotFound {
				return fmt.Errorf("仓库或资源不存在：%s", payload.Message)
			}
			if resp.StatusCode == http.StatusUnprocessableEntity && strings.Contains(strings.ToLower(payload.Message), "reference already exists") {
				return errors.New("这个版本标签已经存在")
			}
			return fmt.Errorf("GitHub：%s", payload.Message)
		}
		return fmt.Errorf("GitHub API 返回 %s", resp.Status)
	}
	if out == nil || resp.StatusCode == http.StatusNoContent {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out)
}

func validateRepo(owner, repo string) error {
	if !ownerPattern.MatchString(owner) || !repoPattern.MatchString(repo) {
		return errors.New("GitHub 仓库格式不正确")
	}
	return nil
}
