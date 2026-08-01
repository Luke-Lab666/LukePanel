package githubhelper

import (
	"archive/zip"
	"context"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	pathpkg "path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	maxGitHubArchiveSize = int64(64 << 20)
	maxGitHubExpanded    = int64(256 << 20)
	maxGitHubFileSize    = int64(32 << 20)
	maxGitHubFiles       = 5000
)

type ImportChange struct {
	Path   string `json:"path"`
	Status string `json:"status"`
	Size   int64  `json:"size"`
	Mode   string `json:"mode"`
}

type ImportPlan struct {
	ID        string         `json:"id"`
	Owner     string         `json:"owner"`
	Repo      string         `json:"repo"`
	Branch    string         `json:"branch"`
	HeadSHA   string         `json:"head_sha"`
	Added     int            `json:"added"`
	Modified  int            `json:"modified"`
	Unchanged int            `json:"unchanged"`
	Skipped   int            `json:"skipped"`
	Bytes     int64          `json:"bytes"`
	Changes   []ImportChange `json:"changes"`
	ExpiresAt time.Time      `json:"expires_at"`
}

type ImportCommitResult struct {
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
	Branch  string `json:"branch"`
	Files   int    `json:"files"`
}

type archiveFile struct {
	Path    string
	Disk    string
	Mode    string
	Size    int64
	BlobSHA string
}

type importPlanState struct {
	Plan     ImportPlan
	Session  string
	TreeSHA  string
	TempDir  string
	Files    map[string]archiveFile
	Existing map[string]gitTreeEntry
}

type Importer struct {
	client  *Client
	baseDir string
	mu      sync.Mutex
	plans   map[string]*importPlanState
}

func NewImporter(client *Client, dataDir string) *Importer {
	return &Importer{client: client, baseDir: filepath.Join(dataDir, "github-imports"), plans: map[string]*importPlanState{}}
}

func (i *Importer) Prepare(ctx context.Context, session, owner, repo, branch, token string, source io.Reader) (ImportPlan, error) {
	if strings.TrimSpace(token) == "" {
		return ImportPlan{}, errors.New("请先通过 GitHub 网页登录")
	}
	if err := validateRepo(owner, repo); err != nil {
		return ImportPlan{}, err
	}
	branch = strings.TrimSpace(branch)
	if err := validateBranch(branch); err != nil {
		return ImportPlan{}, err
	}
	i.cleanupExpired()
	if err := os.MkdirAll(i.baseDir, 0o700); err != nil {
		return ImportPlan{}, err
	}
	planID, err := randomID(18)
	if err != nil {
		return ImportPlan{}, err
	}
	tempDir, err := os.MkdirTemp(i.baseDir, planID+"-")
	if err != nil {
		return ImportPlan{}, err
	}
	failed := true
	defer func() {
		if failed {
			_ = os.RemoveAll(tempDir)
		}
	}()
	files, skipped, total, err := extractGitHubArchive(source, tempDir)
	if err != nil {
		return ImportPlan{}, err
	}
	headSHA, treeSHA, existing, err := i.client.repositoryTree(ctx, owner, repo, branch, token)
	if err != nil {
		return ImportPlan{}, err
	}
	changes := make([]ImportChange, 0, len(files))
	added, modified, unchanged := 0, 0, 0
	for _, file := range files {
		old, exists := existing[file.Path]
		status := "added"
		if exists && old.Type == "blob" {
			if old.SHA == file.BlobSHA && old.Mode == file.Mode {
				unchanged++
				continue
			}
			status = "modified"
			modified++
		} else {
			added++
		}
		changes = append(changes, ImportChange{Path: file.Path, Status: status, Size: file.Size, Mode: file.Mode})
	}
	sort.Slice(changes, func(a, b int) bool { return changes[a].Path < changes[b].Path })
	expires := time.Now().Add(30 * time.Minute)
	plan := ImportPlan{ID: planID, Owner: owner, Repo: repo, Branch: branch, HeadSHA: headSHA, Added: added, Modified: modified, Unchanged: unchanged, Skipped: skipped, Bytes: total, Changes: changes, ExpiresAt: expires}
	i.mu.Lock()
	i.plans[planID] = &importPlanState{Plan: plan, Session: session, TreeSHA: treeSHA, TempDir: tempDir, Files: files, Existing: existing}
	i.mu.Unlock()
	failed = false
	return plan, nil
}

func (i *Importer) Commit(ctx context.Context, session, planID, message, token string) (ImportCommitResult, error) {
	if strings.TrimSpace(token) == "" {
		return ImportCommitResult{}, errors.New("GitHub 登录已失效，请重新连接")
	}
	i.mu.Lock()
	state := i.plans[planID]
	i.mu.Unlock()
	if state == nil || state.Session != session || time.Now().After(state.Plan.ExpiresAt) {
		return ImportCommitResult{}, errors.New("导入预览已过期，请重新上传 ZIP")
	}
	message = strings.TrimSpace(message)
	if message == "" || len(message) > 240 || strings.ContainsRune(message, '\x00') {
		return ImportCommitResult{}, errors.New("请填写 1-240 字符的提交说明")
	}
	if len(state.Plan.Changes) == 0 {
		return ImportCommitResult{}, errors.New("ZIP 内容与仓库一致，没有需要提交的改动")
	}
	headSHA, treeSHA, _, err := i.client.repositoryTree(ctx, state.Plan.Owner, state.Plan.Repo, state.Plan.Branch, token)
	if err != nil {
		return ImportCommitResult{}, err
	}
	if headSHA != state.Plan.HeadSHA || treeSHA != state.TreeSHA {
		return ImportCommitResult{}, errors.New("仓库在预览后发生了变化，请重新上传 ZIP，避免覆盖别人刚提交的内容")
	}
	treeEntries := make([]map[string]any, 0, len(state.Plan.Changes))
	for _, change := range state.Plan.Changes {
		file := state.Files[change.Path]
		content, err := os.ReadFile(file.Disk)
		if err != nil {
			return ImportCommitResult{}, err
		}
		blobSHA, err := i.client.createBlob(ctx, state.Plan.Owner, state.Plan.Repo, token, content)
		if err != nil {
			return ImportCommitResult{}, fmt.Errorf("上传 %s 失败: %w", change.Path, err)
		}
		treeEntries = append(treeEntries, map[string]any{"path": file.Path, "mode": file.Mode, "type": "blob", "sha": blobSHA})
	}
	newTree, err := i.client.createTree(ctx, state.Plan.Owner, state.Plan.Repo, token, state.TreeSHA, treeEntries)
	if err != nil {
		return ImportCommitResult{}, err
	}
	commitSHA, htmlURL, err := i.client.createCommit(ctx, state.Plan.Owner, state.Plan.Repo, token, message, newTree, state.Plan.HeadSHA)
	if err != nil {
		return ImportCommitResult{}, err
	}
	if err := i.client.updateBranch(ctx, state.Plan.Owner, state.Plan.Repo, token, state.Plan.Branch, commitSHA); err != nil {
		return ImportCommitResult{}, err
	}
	i.mu.Lock()
	delete(i.plans, planID)
	i.mu.Unlock()
	_ = os.RemoveAll(state.TempDir)
	return ImportCommitResult{SHA: commitSHA, HTMLURL: htmlURL, Branch: state.Plan.Branch, Files: len(state.Plan.Changes)}, nil
}

func (i *Importer) CleanupSession(session string) {
	i.mu.Lock()
	var dirs []string
	for id, state := range i.plans {
		if state.Session == session {
			dirs = append(dirs, state.TempDir)
			delete(i.plans, id)
		}
	}
	i.mu.Unlock()
	for _, dir := range dirs {
		_ = os.RemoveAll(dir)
	}
}

func (i *Importer) cleanupExpired() {
	i.mu.Lock()
	var dirs []string
	for id, state := range i.plans {
		if time.Now().After(state.Plan.ExpiresAt) {
			dirs = append(dirs, state.TempDir)
			delete(i.plans, id)
		}
	}
	i.mu.Unlock()
	for _, dir := range dirs {
		_ = os.RemoveAll(dir)
	}
}

type gitTreeEntry struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
	Size int64  `json:"size"`
}

func (c *Client) repositoryTree(ctx context.Context, owner, repo, branch, token string) (string, string, map[string]gitTreeEntry, error) {
	var ref struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	if err := c.requestJSON(ctx, http.MethodGet, owner, repo, "/git/ref/heads/"+urlPathEscape(branch), token, nil, &ref); err != nil {
		return "", "", nil, err
	}
	var commit struct {
		Tree struct {
			SHA string `json:"sha"`
		} `json:"tree"`
	}
	if err := c.requestJSON(ctx, http.MethodGet, owner, repo, "/git/commits/"+ref.Object.SHA, token, nil, &commit); err != nil {
		return "", "", nil, err
	}
	var tree struct {
		Tree      []gitTreeEntry `json:"tree"`
		Truncated bool           `json:"truncated"`
	}
	if err := c.requestJSON(ctx, http.MethodGet, owner, repo, "/git/trees/"+commit.Tree.SHA+"?recursive=1", token, nil, &tree); err != nil {
		return "", "", nil, err
	}
	if tree.Truncated {
		return "", "", nil, errors.New("仓库文件树过大，当前轻量导入器无法安全预览")
	}
	existing := make(map[string]gitTreeEntry, len(tree.Tree))
	for _, entry := range tree.Tree {
		if entry.Type == "blob" {
			existing[entry.Path] = entry
		}
	}
	return ref.Object.SHA, commit.Tree.SHA, existing, nil
}

func (c *Client) createBlob(ctx context.Context, owner, repo, token string, content []byte) (string, error) {
	var result struct {
		SHA string `json:"sha"`
	}
	body := map[string]string{"content": base64.StdEncoding.EncodeToString(content), "encoding": "base64"}
	if err := c.requestJSON(ctx, http.MethodPost, owner, repo, "/git/blobs", token, body, &result); err != nil {
		return "", err
	}
	return result.SHA, nil
}

func (c *Client) createTree(ctx context.Context, owner, repo, token, baseTree string, entries []map[string]any) (string, error) {
	var result struct {
		SHA string `json:"sha"`
	}
	if err := c.requestJSON(ctx, http.MethodPost, owner, repo, "/git/trees", token, map[string]any{"base_tree": baseTree, "tree": entries}, &result); err != nil {
		return "", err
	}
	return result.SHA, nil
}

func (c *Client) createCommit(ctx context.Context, owner, repo, token, message, tree, parent string) (string, string, error) {
	var result struct {
		SHA     string `json:"sha"`
		HTMLURL string `json:"html_url"`
	}
	body := map[string]any{"message": message, "tree": tree, "parents": []string{parent}}
	if err := c.requestJSON(ctx, http.MethodPost, owner, repo, "/git/commits", token, body, &result); err != nil {
		return "", "", err
	}
	if result.HTMLURL == "" {
		result.HTMLURL = fmt.Sprintf("https://github.com/%s/%s/commit/%s", owner, repo, result.SHA)
	}
	return result.SHA, result.HTMLURL, nil
}

func (c *Client) updateBranch(ctx context.Context, owner, repo, token, branch, sha string) error {
	return c.requestJSON(ctx, http.MethodPatch, owner, repo, "/git/refs/heads/"+urlPathEscape(branch), token, map[string]any{"sha": sha, "force": false}, nil)
}

func extractGitHubArchive(source io.Reader, tempDir string) (map[string]archiveFile, int, int64, error) {
	archivePath := filepath.Join(tempDir, "upload.zip")
	out, err := os.OpenFile(archivePath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return nil, 0, 0, err
	}
	written, copyErr := io.Copy(out, io.LimitReader(source, maxGitHubArchiveSize+1))
	closeErr := out.Close()
	if copyErr != nil {
		return nil, 0, 0, copyErr
	}
	if closeErr != nil {
		return nil, 0, 0, closeErr
	}
	if written > maxGitHubArchiveSize {
		return nil, 0, 0, errors.New("GitHub 导入 ZIP 不能超过 64MB")
	}
	archive, err := zip.OpenReader(archivePath)
	if err != nil {
		return nil, 0, 0, errors.New("上传的文件不是有效 ZIP")
	}
	defer archive.Close()
	if len(archive.File) > maxGitHubFiles+500 {
		return nil, 0, 0, errors.New("ZIP 中的文件数量过多")
	}
	root := commonArchiveRoot(archive.File)
	files := map[string]archiveFile{}
	skipped := 0
	var total int64
	for _, item := range archive.File {
		name, skip, err := normalizeArchivePath(item.Name, root)
		if err != nil {
			return nil, skipped, total, err
		}
		if skip || item.FileInfo().IsDir() {
			if skip {
				skipped++
			}
			continue
		}
		if item.Mode()&os.ModeSymlink != 0 {
			return nil, skipped, total, fmt.Errorf("ZIP 包含符号链接：%s", name)
		}
		if item.UncompressedSize64 > uint64(maxGitHubFileSize) || total+int64(item.UncompressedSize64) > maxGitHubExpanded {
			return nil, skipped, total, errors.New("ZIP 解压后的文件体积超过安全限制")
		}
		disk := filepath.Join(tempDir, "files", filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(disk), 0o700); err != nil {
			return nil, skipped, total, err
		}
		r, err := item.Open()
		if err != nil {
			return nil, skipped, total, err
		}
		f, err := os.OpenFile(disk, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
		if err != nil {
			r.Close()
			return nil, skipped, total, err
		}
		copied, copyErr := io.Copy(f, io.LimitReader(r, maxGitHubFileSize+1))
		r.Close()
		closeErr := f.Close()
		if copyErr != nil || closeErr != nil || copied > maxGitHubFileSize {
			if copyErr != nil {
				return nil, skipped, total, copyErr
			}
			if closeErr != nil {
				return nil, skipped, total, closeErr
			}
			return nil, skipped, total, fmt.Errorf("文件过大：%s", name)
		}
		mode := "100644"
		if item.Mode().Perm()&0o111 != 0 {
			mode = "100755"
		}
		blobHash := sha1.New()
		_, _ = fmt.Fprintf(blobHash, "blob %d\x00", copied)
		content, _ := os.ReadFile(disk)
		_, _ = blobHash.Write(content)
		files[name] = archiveFile{Path: name, Disk: disk, Mode: mode, Size: copied, BlobSHA: fmt.Sprintf("%x", blobHash.Sum(nil))}
		total += copied
		if len(files) > maxGitHubFiles {
			return nil, skipped, total, errors.New("ZIP 中可提交文件超过 5000 个")
		}
	}
	if len(files) == 0 {
		return nil, skipped, total, errors.New("ZIP 中没有可提交文件")
	}
	return files, skipped, total, nil
}

func commonArchiveRoot(files []*zip.File) string {
	root := ""
	seen := false
	for _, item := range files {
		clean := pathpkg.Clean(strings.ReplaceAll(item.Name, `\\`, "/"))
		if clean == "." || clean == "" || strings.HasPrefix(clean, "__MACOSX/") {
			continue
		}
		parts := strings.Split(clean, "/")
		if len(parts) < 2 {
			return ""
		}
		if !seen {
			root, seen = parts[0], true
		} else if parts[0] != root {
			return ""
		}
	}
	if seen {
		return root
	}
	return ""
}

func normalizeArchivePath(value, root string) (string, bool, error) {
	clean := pathpkg.Clean(strings.ReplaceAll(value, `\\`, "/"))
	if root != "" && (clean == root || strings.HasPrefix(clean, root+"/")) {
		clean = strings.TrimPrefix(clean, root)
		clean = strings.TrimPrefix(clean, "/")
	}
	if clean == "." || clean == "" {
		return "", true, nil
	}
	if pathpkg.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") || strings.ContainsRune(clean, '\x00') {
		return "", false, errors.New("ZIP 包含不安全路径")
	}
	if clean == ".git" || strings.HasPrefix(clean, ".git/") || clean == ".DS_Store" || strings.HasPrefix(clean, "__MACOSX/") {
		return "", true, nil
	}
	return clean, false, nil
}

func validateBranch(branch string) error {
	if branch == "" || len(branch) > 200 || strings.HasPrefix(branch, "/") || strings.HasSuffix(branch, "/") || strings.Contains(branch, "..") || strings.Contains(branch, "@{") || strings.ContainsAny(branch, " ~^:?*[\\\x00\r\n") {
		return errors.New("GitHub 分支名称无效")
	}
	return nil
}

func urlPathEscape(value string) string {
	return url.PathEscape(value)
}

func randomID(size int) (string, error) {
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}
