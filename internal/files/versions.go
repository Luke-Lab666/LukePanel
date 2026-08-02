package files

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"
)

type BackupVersion struct {
	ID        string    `json:"id"`
	Path      string    `json:"path"`
	Name      string    `json:"name"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
}

type FileDiff struct {
	Path       string    `json:"path"`
	BackupID   string    `json:"backup_id"`
	BackupTime time.Time `json:"backup_time"`
	Diff       string    `json:"diff"`
	Truncated  bool      `json:"truncated"`
}

func (m *Manager) ListBackups(path string) ([]BackupVersion, error) {
	resolved, _, err := m.resolveExisting(path, false)
	if err != nil {
		return nil, err
	}
	return m.listBackupsForResolved(resolved)
}

func (m *Manager) BackupDiff(path, id string) (FileDiff, error) {
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return FileDiff{}, err
	}
	if info.Size() > MaxEditableSize {
		return FileDiff{}, errors.New("文件超过 2MB，无法在线对比")
	}
	backupPath, backupInfo, err := m.resolveBackup(resolved, id)
	if err != nil {
		return FileDiff{}, err
	}
	if backupInfo.Size() > MaxEditableSize {
		return FileDiff{}, errors.New("备份文件超过 2MB，无法在线对比")
	}
	current, err := os.ReadFile(resolved)
	if err != nil {
		return FileDiff{}, err
	}
	previous, err := os.ReadFile(backupPath)
	if err != nil {
		return FileDiff{}, err
	}
	if isBinary(current) || isBinary(previous) {
		return FileDiff{}, errors.New("二进制文件无法在线对比")
	}
	diff, truncated := unifiedLineDiff(string(previous), string(current), filepath.Base(resolved), backupInfo.ModTime())
	return FileDiff{Path: resolved, BackupID: id, BackupTime: backupInfo.ModTime(), Diff: diff, Truncated: truncated}, nil
}

func (m *Manager) RestoreBackup(path, id string) error {
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return err
	}
	if err := ensureWritablePath(resolved); err != nil {
		return err
	}
	backupPath, backupInfo, err := m.resolveBackup(resolved, id)
	if err != nil {
		return err
	}
	if backupInfo.Size() > 20<<20 {
		return errors.New("备份文件超过 20MB，无法在线恢复")
	}
	if err := m.backup(resolved, info); err != nil {
		return fmt.Errorf("恢复前创建当前版本备份失败: %w", err)
	}
	src, err := os.Open(backupPath)
	if err != nil {
		return err
	}
	defer src.Close()
	tmp, err := os.CreateTemp(filepath.Dir(resolved), ".lukepanel-restore-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(info.Mode().Perm()); err != nil {
		tmp.Close()
		return err
	}
	written, err := io.Copy(tmp, io.LimitReader(src, (20<<20)+1))
	if err != nil {
		tmp.Close()
		return err
	}
	if written > 20<<20 {
		tmp.Close()
		return errors.New("备份文件超过 20MB，无法在线恢复")
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chown(tmpName, statUID(info), statGID(info)); err != nil && !errors.Is(err, syscall.EPERM) {
		return err
	}
	return os.Rename(tmpName, resolved)
}

func (m *Manager) listBackupsForResolved(resolved string) ([]BackupVersion, error) {
	dir := filepath.Join(m.dataDir, "backups", "files")
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return []BackupVersion{}, nil
	}
	if err != nil {
		return nil, err
	}
	prefix := backupPrefix(resolved)
	out := make([]BackupVersion, 0, 8)
	for _, entry := range entries {
		if entry.IsDir() || !strings.Contains(entry.Name(), "-"+prefix+"-") || !strings.HasSuffix(entry.Name(), ".bak") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		out = append(out, BackupVersion{ID: entry.Name(), Path: resolved, Name: filepath.Base(resolved), Size: info.Size(), CreatedAt: info.ModTime()})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if len(out) > 50 {
		out = out[:50]
	}
	return out, nil
}

func (m *Manager) resolveBackup(resolved, id string) (string, os.FileInfo, error) {
	if id == "" || filepath.Base(id) != id || strings.ContainsAny(id, `/\\`) || !strings.HasSuffix(id, ".bak") {
		return "", nil, errors.New("备份版本编号无效")
	}
	if !strings.Contains(id, "-"+backupPrefix(resolved)+"-") {
		return "", nil, errors.New("备份版本与当前文件不匹配")
	}
	path := filepath.Join(m.dataDir, "backups", "files", id)
	info, err := os.Stat(path)
	if err != nil {
		return "", nil, err
	}
	if !info.Mode().IsRegular() {
		return "", nil, errors.New("备份版本格式异常")
	}
	return path, info, nil
}

func backupPrefix(path string) string {
	sum := sha256.Sum256([]byte(path))
	return hex.EncodeToString(sum[:8])
}

func unifiedLineDiff(oldText, newText, name string, backupTime time.Time) (string, bool) {
	oldLines := splitLines(oldText)
	newLines := splitLines(newText)
	truncated := false
	const maxLines = 1200
	if len(oldLines) > maxLines {
		oldLines = oldLines[:maxLines]
		truncated = true
	}
	if len(newLines) > maxLines {
		newLines = newLines[:maxLines]
		truncated = true
	}
	// Dynamic LCS remains cheap for normal configuration files. For unusually
	// large changes use a prefix/suffix fallback to keep the Agent responsive.
	if len(oldLines)*len(newLines) > 900000 {
		return simpleChangedBlock(oldLines, newLines, name, backupTime), true
	}
	dp := make([][]uint16, len(oldLines)+1)
	for i := range dp {
		dp[i] = make([]uint16, len(newLines)+1)
	}
	for i := len(oldLines) - 1; i >= 0; i-- {
		for j := len(newLines) - 1; j >= 0; j-- {
			if oldLines[i] == newLines[j] {
				dp[i][j] = dp[i+1][j+1] + 1
			} else if dp[i+1][j] >= dp[i][j+1] {
				dp[i][j] = dp[i+1][j]
			} else {
				dp[i][j] = dp[i][j+1]
			}
		}
	}
	var b strings.Builder
	fmt.Fprintf(&b, "--- %s（备份 %s）\n+++ %s（当前）\n", name, backupTime.Local().Format("2006-01-02 15:04:05"), name)
	i, j := 0, 0
	for i < len(oldLines) && j < len(newLines) {
		if oldLines[i] == newLines[j] {
			fmt.Fprintln(&b, " "+oldLines[i])
			i++
			j++
		} else if dp[i+1][j] >= dp[i][j+1] {
			fmt.Fprintln(&b, "-"+oldLines[i])
			i++
		} else {
			fmt.Fprintln(&b, "+"+newLines[j])
			j++
		}
	}
	for ; i < len(oldLines); i++ {
		fmt.Fprintln(&b, "-"+oldLines[i])
	}
	for ; j < len(newLines); j++ {
		fmt.Fprintln(&b, "+"+newLines[j])
	}
	return b.String(), truncated
}

func simpleChangedBlock(oldLines, newLines []string, name string, backupTime time.Time) string {
	prefix := 0
	for prefix < len(oldLines) && prefix < len(newLines) && oldLines[prefix] == newLines[prefix] {
		prefix++
	}
	suffix := 0
	for suffix < len(oldLines)-prefix && suffix < len(newLines)-prefix && oldLines[len(oldLines)-1-suffix] == newLines[len(newLines)-1-suffix] {
		suffix++
	}
	var b strings.Builder
	fmt.Fprintf(&b, "--- %s（备份 %s）\n+++ %s（当前）\n", name, backupTime.Local().Format("2006-01-02 15:04:05"), name)
	for _, line := range oldLines[:prefix] {
		fmt.Fprintln(&b, " "+line)
	}
	for _, line := range oldLines[prefix : len(oldLines)-suffix] {
		fmt.Fprintln(&b, "-"+line)
	}
	for _, line := range newLines[prefix : len(newLines)-suffix] {
		fmt.Fprintln(&b, "+"+line)
	}
	for _, line := range oldLines[len(oldLines)-suffix:] {
		fmt.Fprintln(&b, " "+line)
	}
	return b.String()
}

func splitLines(text string) []string {
	scanner := bufio.NewScanner(bytes.NewBufferString(text))
	scanner.Buffer(make([]byte, 64<<10), 2<<20)
	lines := []string{}
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if strings.HasSuffix(text, "\n") {
		lines = append(lines, "")
	}
	return lines
}
