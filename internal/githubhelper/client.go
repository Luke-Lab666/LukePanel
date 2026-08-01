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
	ownerPattern  = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`)
	repoPattern   = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
	tagPattern    = regexp.MustCompile(`^v[0-9][A-Za-z0-9._-]{0,63}$`)
	branchPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$`)
)

type Client struct {
	http    *http.Client
	apiBase string
	webBase string
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
	Branches      []Branch      `json:"branches"`
	LatestRelease *Release      `json:"latest_release,omitempty"`
	WorkflowRuns  []WorkflowRun `json:"workflow_runs"`
}

type Tag struct {
	Name string `json:"name"`
	SHA  string `json:"sha"`
}

type Branch struct {
	Name      string `json:"name"`
	SHA       string `json:"sha"`
	Protected bool   `json:"protected"`
}

type PullRequest struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	State   string `json:"state"`
	HTMLURL string `json:"html_url"`
	Head    string `json:"head"`
	Base    string `json:"base"`
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
	return &Client{http: &http.Client{Timeout: 30 * time.Second}, apiBase: "https://api.github.com", webBase: "https://github.com"}
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
	var rawBranches []struct {
		Name      string `json:"name"`
		Protected bool   `json:"protected"`
		Commit    struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	_ = c.get(ctx, owner, repo, "/branches?per_page=20", token, &rawBranches)
	branches := make([]Branch, 0, len(rawBranches))
	for _, item := range rawBranches {
		branches = append(branches, Branch{Name: item.Name, SHA: item.Commit.SHA, Protected: item.Protected})
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
	return RepositorySummary{Owner: owner, Name: repo, FullName: metadata.FullName, Description: metadata.Description, Visibility: metadata.Visibility, DefaultBranch: metadata.DefaultBranch, UpdatedAt: metadata.UpdatedAt, MainSHA: branch.Commit.SHA, Tags: tags, Branches: branches, LatestRelease: latestPtr, WorkflowRuns: runs.WorkflowRuns}, nil
}

func (c *Client) CreateBranch(ctx context.Context, owner, repo, name, source, token string) (Branch, error) {
	if err := validateRepo(owner, repo); err != nil {
		return Branch{}, err
	}
	if err := validateBranchName(name); err != nil {
		return Branch{}, err
	}
	if strings.TrimSpace(token) == "" {
		return Branch{}, errors.New("请先连接 GitHub")
	}
	source = strings.TrimSpace(source)
	if source == "" {
		summary, err := c.Summary(ctx, owner, repo, token)
		if err != nil {
			return Branch{}, err
		}
		source = summary.DefaultBranch
	}
	if err := validateBranchName(source); err != nil {
		return Branch{}, errors.New("源分支名称无效")
	}
	var sourceBranch struct {
		Name   string `json:"name"`
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	if err := c.get(ctx, owner, repo, "/branches/"+url.PathEscape(source), token, &sourceBranch); err != nil {
		return Branch{}, err
	}
	payload := map[string]string{"ref": "refs/heads/" + name, "sha": sourceBranch.Commit.SHA}
	if err := c.requestJSON(ctx, http.MethodPost, owner, repo, "/git/refs", token, payload, nil); err != nil {
		return Branch{}, err
	}
	return Branch{Name: name, SHA: sourceBranch.Commit.SHA}, nil
}

func (c *Client) CreatePullRequest(ctx context.Context, owner, repo, title, body, head, base, token string) (PullRequest, error) {
	if err := validateRepo(owner, repo); err != nil {
		return PullRequest{}, err
	}
	if err := validateBranchName(head); err != nil {
		return PullRequest{}, errors.New("提交分支名称无效")
	}
	if err := validateBranchName(base); err != nil {
		return PullRequest{}, errors.New("目标分支名称无效")
	}
	title = strings.TrimSpace(title)
	body = strings.TrimSpace(body)
	if title == "" || len(title) > 200 {
		return PullRequest{}, errors.New("PR 标题必须是 1-200 个字符")
	}
	if len(body) > 20000 {
		return PullRequest{}, errors.New("PR 说明过长")
	}
	if head == base {
		return PullRequest{}, errors.New("提交分支和目标分支不能相同")
	}
	if strings.TrimSpace(token) == "" {
		return PullRequest{}, errors.New("请先连接 GitHub")
	}
	payload := map[string]any{"title": title, "body": body, "head": head, "base": base, "draft": false}
	var raw struct {
		Number  int    `json:"number"`
		Title   string `json:"title"`
		State   string `json:"state"`
		HTMLURL string `json:"html_url"`
		Head    struct {
			Ref string `json:"ref"`
		} `json:"head"`
		Base struct {
			Ref string `json:"ref"`
		} `json:"base"`
	}
	if err := c.requestJSON(ctx, http.MethodPost, owner, repo, "/pulls", token, payload, &raw); err != nil {
		return PullRequest{}, err
	}
	return PullRequest{Number: raw.Number, Title: raw.Title, State: raw.State, HTMLURL: raw.HTMLURL, Head: raw.Head.Ref, Base: raw.Base.Ref}, nil
}

func (c *Client) CreateTag(ctx context.Context, owner, repo, tag, targetSHA, token string) error {
	if err := validateRepo(owner, repo); err != nil {
		return err
	}
	if !tagPattern.MatchString(tag) {
		return errors.New("版本号必须以小写 v 开头，例如 v0.6.0-alpha")
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
	endpoint := fmt.Sprintf("%s/repos/%s/%s%s", strings.TrimRight(c.apiBase, "/"), url.PathEscape(owner), url.PathEscape(repo), suffix)
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
		return decodeGitHubError(resp)
	}
	if out == nil || resp.StatusCode == http.StatusNoContent {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 16<<20)).Decode(out)
}

func validateRepo(owner, repo string) error {
	if !ownerPattern.MatchString(owner) || !repoPattern.MatchString(repo) {
		return errors.New("GitHub 仓库格式不正确")
	}
	return nil
}

func validateBranchName(branch string) error {
	branch = strings.TrimSpace(branch)
	if !branchPattern.MatchString(branch) || strings.Contains(branch, "..") || strings.Contains(branch, "//") || strings.Contains(branch, "@{") || strings.HasSuffix(branch, "/") || strings.HasSuffix(branch, ".") || strings.HasSuffix(strings.ToLower(branch), ".lock") {
		return errors.New("分支名称只能包含字母、数字、点、短横线、下划线和斜杠")
	}
	return nil
}

func decodeGitHubError(resp *http.Response) error {
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 128<<10))
	var payload struct {
		Message string `json:"message"`
		Errors  any    `json:"errors"`
	}
	if json.Unmarshal(data, &payload) == nil && payload.Message != "" {
		lower := strings.ToLower(payload.Message)
		if resp.StatusCode == http.StatusNotFound {
			return fmt.Errorf("仓库或资源不存在：%s", payload.Message)
		}
		if resp.StatusCode == http.StatusUnprocessableEntity && strings.Contains(lower, "reference already exists") {
			return errors.New("这个版本标签已经存在")
		}
		if resp.StatusCode == http.StatusForbidden && strings.Contains(lower, "resource not accessible") {
			return errors.New("GitHub 授权权限不足，请确认已允许 Contents 写入；修改 Actions 工作流还需要 workflow 权限")
		}
		return fmt.Errorf("GitHub：%s", payload.Message)
	}
	return fmt.Errorf("GitHub API 返回 %s", resp.Status)
}
