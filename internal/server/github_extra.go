package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

func (s *Server) githubActionJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	runID, err := strconv.ParseInt(r.URL.Query().Get("run_id"), 10, 64)
	if err != nil || runID <= 0 {
		writeError(w, 400, "Actions 运行编号无效")
		return
	}
	session, _ := sessionFromContext(r)
	jobs, err := s.github.WorkflowJobs(r.Context(), r.URL.Query().Get("owner"), r.URL.Query().Get("repo"), runID, s.githubToken(session.ID))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"jobs": jobs})
}

func (s *Server) githubActionJobLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	jobID, err := strconv.ParseInt(r.URL.Query().Get("job_id"), 10, 64)
	if err != nil || jobID <= 0 {
		writeError(w, 400, "Actions Job 编号无效")
		return
	}
	session, _ := sessionFromContext(r)
	logs, err := s.github.WorkflowJobLogs(r.Context(), r.URL.Query().Get("owner"), r.URL.Query().Get("repo"), jobID, s.githubToken(session.ID))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if len(logs) > 8<<20 {
		logs = logs[:8<<20] + "\n…日志已截断…"
	}
	writeJSON(w, 200, map[string]any{"logs": logs})
}

func (s *Server) githubReleaseAssets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	session, _ := sessionFromContext(r)
	assets, err := s.github.ReleaseAssets(r.Context(), r.URL.Query().Get("owner"), r.URL.Query().Get("repo"), r.URL.Query().Get("tag"), s.githubToken(session.ID))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"assets": assets})
}

func (s *Server) githubReleaseAssetUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	if !s.cfg.SecureCookie {
		writeError(w, 400, "必须通过 HTTPS 上传 Release 附件")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 260<<20)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, 400, "附件格式错误或超过 256MB")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, 400, "请选择附件")
		return
	}
	defer file.Close()
	owner, repo, tag := strings.TrimSpace(r.FormValue("owner")), strings.TrimSpace(r.FormValue("repo")), strings.TrimSpace(r.FormValue("tag"))
	session, _ := sessionFromContext(r)
	asset, err := s.github.UploadReleaseAsset(r.Context(), owner, repo, tag, header.Filename, header.Header.Get("Content-Type"), s.githubToken(session.ID), header.Size, file)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	s.auditRequest(r, "github.release.asset.upload", fmt.Sprintf("%s/%s:%s/%s", owner, repo, tag, header.Filename), "success", fmt.Sprintf("%d bytes", header.Size))
	writeJSON(w, 200, asset)
}
