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
	PullRequests  []PullRequest `json:"pull_requests"`
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
	HeadSHA string `json:"head_sha"`
	Base    string `json:"base"`
	Draft   bool   `json:"draft"`
}

type PullRequestMerge struct {
	SHA     string `json:"sha"`
	Merged  bool   `json:"merged"`
	Message string `json:"message"`
}

type Release struct {
	ID          int64  `json:"id"`
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`
	Draft       bool   `json:"draft"`
	Prerelease  bool   `json:"prerelease"`
}

type WorkflowJob struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Status      string `json:"status"`
	Conclusion  string `json:"conclusion"`
	StartedAt   string `json:"started_at"`
	CompletedAt string `json:"completed_at"`
	HTMLURL     string `json:"html_url"`
}

type ReleaseAsset struct {
	ID                 int64  `json:"id"`
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	DownloadCount      int    `json:"download_count"`
	BrowserDownloadURL string `json:"browser_download_url"`
	CreatedAt          string `json:"created_at"`
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
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 30 * time.Second
	transport.IdleConnTimeout = 90 * time.Second
	transport.MaxIdleConnsPerHost = 8
	return &Client{http: &http.Client{Transport: transport, Timeout: 10 * time.Minute}, apiBase: "https://api.github.com", webBase: "https://github.com"}
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
	pulls, _ := c.ListPullRequests(ctx, owner, repo, token)
	return RepositorySummary{Owner: owner, Name: repo, FullName: metadata.FullName, Description: metadata.Description, Visibility: metadata.Visibility, DefaultBranch: metadata.DefaultBranch, UpdatedAt: metadata.UpdatedAt, MainSHA: branch.Commit.SHA, Tags: tags, Branches: branches, LatestRelease: latestPtr, WorkflowRuns: runs.WorkflowRuns, PullRequests: pulls}, nil
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
		Draft   bool   `json:"draft"`
		Head    struct {
			Ref string `json:"ref"`
			SHA string `json:"sha"`
		} `json:"head"`
		Base struct {
			Ref string `json:"ref"`
		} `json:"base"`
	}
	if err := c.requestJSON(ctx, http.MethodPost, owner, repo, "/pulls", token, payload, &raw); err != nil {
		return PullRequest{}, err
	}
	return PullRequest{Number: raw.Number, Title: raw.Title, State: raw.State, HTMLURL: raw.HTMLURL, Head: raw.Head.Ref, HeadSHA: raw.Head.SHA, Base: raw.Base.Ref, Draft: raw.Draft}, nil
}

func (c *Client) ListPullRequests(ctx context.Context, owner, repo, token string) ([]PullRequest, error) {
	if err := validateRepo(owner, repo); err != nil {
		return nil, err
	}
	var raw []struct {
		Number  int    `json:"number"`
		Title   string `json:"title"`
		State   string `json:"state"`
		HTMLURL string `json:"html_url"`
		Draft   bool   `json:"draft"`
		Head    struct {
			Ref string `json:"ref"`
			SHA string `json:"sha"`
		} `json:"head"`
		Base struct {
			Ref string `json:"ref"`
		} `json:"base"`
	}
	if err := c.get(ctx, owner, repo, "/pulls?state=open&per_page=20&sort=updated&direction=desc", token, &raw); err != nil {
		return nil, err
	}
	items := make([]PullRequest, 0, len(raw))
	for _, item := range raw {
		items = append(items, PullRequest{Number: item.Number, Title: item.Title, State: item.State, HTMLURL: item.HTMLURL, Head: item.Head.Ref, HeadSHA: item.Head.SHA, Base: item.Base.Ref, Draft: item.Draft})
	}
	return items, nil
}

func (c *Client) MergePullRequest(ctx context.Context, owner, repo string, number int, expectedSHA, method, token string) (PullRequestMerge, error) {
	if err := validateRepo(owner, repo); err != nil {
		return PullRequestMerge{}, err
	}
	if number < 1 {
		return PullRequestMerge{}, errors.New("Pull Request 编号无效")
	}
	if strings.TrimSpace(token) == "" {
		return PullRequestMerge{}, errors.New("请先连接 GitHub")
	}
	method = strings.TrimSpace(method)
	if method == "" {
		method = "squash"
	}
	if method != "squash" && method != "merge" && method != "rebase" {
		return PullRequestMerge{}, errors.New("不支持的合并方式")
	}
	payload := map[string]any{"merge_method": method}
	if expectedSHA != "" {
		if len(expectedSHA) < 7 || len(expectedSHA) > 64 {
			return PullRequestMerge{}, errors.New("PR 提交 SHA 无效")
		}
		payload["sha"] = expectedSHA
	}
	var result PullRequestMerge
	if err := c.requestJSON(ctx, http.MethodPut, owner, repo, fmt.Sprintf("/pulls/%d/merge", number), token, payload, &result); err != nil {
		return PullRequestMerge{}, err
	}
	if !result.Merged {
		if result.Message == "" {
			result.Message = "GitHub 没有合并这个 Pull Request"
		}
		return result, errors.New(result.Message)
	}
	return result, nil
}

func (c *Client) CreateTag(ctx context.Context, owner, repo, tag, targetSHA, token string) error {
	if err := validateRepo(owner, repo); err != nil {
		return err
	}
	if !tagPattern.MatchString(tag) {
		return errors.New("版本号必须以小写 v 开头，例如 v2.0.7")
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

type CreateReleaseRequest struct {
	Tag        string `json:"tag"`
	Name       string `json:"name"`
	Body       string `json:"body"`
	Draft      bool   `json:"draft"`
	Prerelease bool   `json:"prerelease"`
}

func (c *Client) CreateRelease(ctx context.Context, owner, repo string, request CreateReleaseRequest, token string) (Release, error) {
	if err := validateRepo(owner, repo); err != nil {
		return Release{}, err
	}
	if !tagPattern.MatchString(strings.TrimSpace(request.Tag)) {
		return Release{}, errors.New("Release 标签格式不正确")
	}
	if strings.TrimSpace(token) == "" {
		return Release{}, errors.New("请先连接 GitHub")
	}
	request.Name = strings.TrimSpace(request.Name)
	request.Body = strings.TrimSpace(request.Body)
	if request.Name == "" {
		request.Name = request.Tag
	}
	if len(request.Name) > 200 || len(request.Body) > 50000 {
		return Release{}, errors.New("Release 标题或说明过长")
	}
	payload := map[string]any{"tag_name": request.Tag, "name": request.Name, "body": request.Body, "draft": request.Draft, "prerelease": request.Prerelease, "generate_release_notes": request.Body == ""}
	var release Release
	if err := c.requestJSON(ctx, http.MethodPost, owner, repo, "/releases", token, payload, &release); err != nil {
		return Release{}, err
	}
	return release, nil
}

func (c *Client) WorkflowJobs(ctx context.Context, owner, repo string, runID int64, token string) ([]WorkflowJob, error) {
	if err := validateRepo(owner, repo); err != nil {
		return nil, err
	}
	if runID <= 0 {
		return nil, errors.New("Actions 运行编号无效")
	}
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("请先连接 GitHub")
	}
	var raw struct {
		Jobs []WorkflowJob `json:"jobs"`
	}
	if err := c.get(ctx, owner, repo, fmt.Sprintf("/actions/runs/%d/jobs?per_page=100", runID), token, &raw); err != nil {
		return nil, err
	}
	return raw.Jobs, nil
}

func (c *Client) WorkflowJobLogs(ctx context.Context, owner, repo string, jobID int64, token string) (string, error) {
	if err := validateRepo(owner, repo); err != nil {
		return "", err
	}
	if jobID <= 0 {
		return "", errors.New("Actions Job 编号无效")
	}
	if strings.TrimSpace(token) == "" {
		return "", errors.New("请先连接 GitHub")
	}
	endpoint := fmt.Sprintf("%s/repos/%s/%s/actions/jobs/%d/logs", strings.TrimRight(c.apiBase, "/"), url.PathEscape(owner), url.PathEscape(repo), jobID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "LukePanel-GitHub-Helper")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", decodeGitHubError(resp)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (c *Client) ReleaseByTag(ctx context.Context, owner, repo, tag, token string) (Release, error) {
	if err := validateRepo(owner, repo); err != nil {
		return Release{}, err
	}
	if !tagPattern.MatchString(strings.TrimSpace(tag)) {
		return Release{}, errors.New("Release 标签格式不正确")
	}
	var release Release
	err := c.get(ctx, owner, repo, "/releases/tags/"+url.PathEscape(tag), token, &release)
	return release, err
}
func (c *Client) ReleaseAssets(ctx context.Context, owner, repo, tag, token string) ([]ReleaseAsset, error) {
	release, err := c.ReleaseByTag(ctx, owner, repo, tag, token)
	if err != nil {
		return nil, err
	}
	var items []ReleaseAsset
	if err := c.get(ctx, owner, repo, fmt.Sprintf("/releases/%d/assets?per_page=100", release.ID), token, &items); err != nil {
		return nil, err
	}
	return items, nil
}
func (c *Client) UploadReleaseAsset(ctx context.Context, owner, repo, tag, name, contentType, token string, size int64, reader io.Reader) (ReleaseAsset, error) {
	if size < 1 || size > 256<<20 {
		return ReleaseAsset{}, errors.New("Release 附件必须在 1B-256MB 之间")
	}
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 200 || strings.ContainsAny(name, "/\\\x00\r\n") {
		return ReleaseAsset{}, errors.New("附件文件名无效")
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	release, err := c.ReleaseByTag(ctx, owner, repo, tag, token)
	if err != nil {
		return ReleaseAsset{}, err
	}
	endpoint := fmt.Sprintf("https://uploads.github.com/repos/%s/%s/releases/%d/assets?name=%s", url.PathEscape(owner), url.PathEscape(repo), release.ID, url.QueryEscape(name))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, reader)
	if err != nil {
		return ReleaseAsset{}, err
	}
	req.ContentLength = size
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "LukePanel-GitHub-Helper")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	resp, err := c.http.Do(req)
	if err != nil {
		return ReleaseAsset{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return ReleaseAsset{}, decodeGitHubError(resp)
	}
	var asset ReleaseAsset
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(&asset); err != nil {
		return ReleaseAsset{}, err
	}
	return asset, nil
}
