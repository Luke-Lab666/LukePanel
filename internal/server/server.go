package server

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/agent"
	"github.com/Luke-Lab666/LukePanel/internal/auth"
	"github.com/Luke-Lab666/LukePanel/internal/config"
	"github.com/Luke-Lab666/LukePanel/internal/githubhelper"
	"github.com/Luke-Lab666/LukePanel/internal/system"
	"github.com/Luke-Lab666/LukePanel/internal/tools"
)

//go:embed webdist/*
var webAssets embed.FS

type Server struct {
	cfg        config.Config
	configPath string
	version    string
	configMu   sync.RWMutex
	http       *http.Server
	collector  *system.Collector
	agent      *agent.Client
	github     *githubhelper.Client
	sessions   *auth.Store
	limiter    *auth.LoginLimiter
	audit      *AuditLog
	logger     *slog.Logger
	elevatedMu sync.Mutex
	elevated   map[string]time.Time
}

func New(cfg config.Config, configPath, version string, logger *slog.Logger) (*Server, error) {
	s := &Server{
		cfg: cfg, configPath: configPath, version: version, collector: system.NewCollector(),
		agent: agent.NewClient(cfg.AgentSocket, cfg.AgentSecret), github: githubhelper.New(), sessions: auth.NewStore(cfg.SessionSecret, 24*time.Hour),
		limiter: auth.NewLoginLimiter(), audit: NewAuditLog(cfg.DataDir), logger: logger, elevated: make(map[string]time.Time),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/health", s.health)
	mux.HandleFunc("/api/v1/auth/login", s.login)
	mux.HandleFunc("/api/v1/auth/logout", s.requireAuth(s.logout))
	mux.HandleFunc("/api/v1/auth/password", s.requireAuth(s.changePassword))
	mux.HandleFunc("/api/v1/auth/elevate", s.requireAuth(s.elevate))
	mux.HandleFunc("/api/v1/auth/me", s.requireAuth(s.me))
	mux.HandleFunc("/api/v1/auth/sessions", s.requireAuth(s.sessionManagement))
	mux.HandleFunc("/api/v1/system/overview", s.requireAuth(s.overview))
	mux.HandleFunc("/api/v1/system/overview/stream", s.requireAuth(s.overviewStream))
	mux.HandleFunc("/api/v1/system/services", s.requireAuth(s.serviceList))
	mux.HandleFunc("/api/v1/system/services/action", s.requireAuth(s.serviceAction))
	mux.HandleFunc("/api/v1/system/services/logs", s.requireAuth(s.serviceLogs))
	mux.HandleFunc("/api/v1/system/processes", s.requireAuth(s.processList))
	mux.HandleFunc("/api/v1/system/processes/action", s.requireAuth(s.processAction))
	mux.HandleFunc("/api/v1/system/network", s.requireAuth(s.networkInfo))
	mux.HandleFunc("/api/v1/system/storage", s.requireAuth(s.storageInfo))
	mux.HandleFunc("/api/v1/system/timers", s.requireAuth(s.timerInfo))
	mux.HandleFunc("/api/v1/system/updates", s.requireAuth(s.updateInfo))
	mux.HandleFunc("/api/v1/docker/status", s.requireAuth(s.dockerStatus))
	mux.HandleFunc("/api/v1/docker/containers", s.requireAuth(s.dockerContainers))
	mux.HandleFunc("/api/v1/docker/action", s.requireAuth(s.dockerAction))
	mux.HandleFunc("/api/v1/docker/logs", s.requireAuth(s.dockerLogs))
	mux.HandleFunc("/api/v1/docker/images", s.requireAuth(s.dockerImages))
	mux.HandleFunc("/api/v1/docker/images/pull", s.requireAuth(s.dockerImagePull))
	mux.HandleFunc("/api/v1/docker/images/delete", s.requireAuth(s.dockerImageDelete))
	mux.HandleFunc("/api/v1/docker/networks", s.requireAuth(s.dockerNetworks))
	mux.HandleFunc("/api/v1/docker/networks/delete", s.requireAuth(s.dockerNetworkDelete))
	mux.HandleFunc("/api/v1/docker/volumes", s.requireAuth(s.dockerVolumes))
	mux.HandleFunc("/api/v1/docker/volumes/delete", s.requireAuth(s.dockerVolumeDelete))
	mux.HandleFunc("/api/v1/docker/compose", s.requireAuth(s.dockerCompose))
	mux.HandleFunc("/api/v1/docker/compose/action", s.requireAuth(s.dockerComposeAction))
	mux.HandleFunc("/api/v1/files", s.requireAuth(s.files))
	mux.HandleFunc("/api/v1/files/content", s.requireAuth(s.fileContent))
	mux.HandleFunc("/api/v1/files/create", s.requireAuth(s.fileCreate))
	mux.HandleFunc("/api/v1/files/mkdir", s.requireAuth(s.fileMkdir))
	mux.HandleFunc("/api/v1/files/rename", s.requireAuth(s.fileRename))
	mux.HandleFunc("/api/v1/files/delete", s.requireAuth(s.fileDelete))
	mux.HandleFunc("/api/v1/files/download", s.requireAuth(s.fileDownload))
	mux.HandleFunc("/api/v1/files/upload", s.requireAuth(s.fileUpload))
	mux.HandleFunc("/api/v1/files/copy", s.requireAuth(s.fileCopy))
	mux.HandleFunc("/api/v1/files/move", s.requireAuth(s.fileMove))
	mux.HandleFunc("/api/v1/files/chmod", s.requireAuth(s.fileChmod))
	mux.HandleFunc("/api/v1/files/recycle", s.requireAuth(s.fileRecycle))
	mux.HandleFunc("/api/v1/ssh/status", s.requireAuth(s.sshStatus))
	mux.HandleFunc("/api/v1/ssh/users", s.requireAuth(s.sshUsers))
	mux.HandleFunc("/api/v1/ssh/keys", s.requireAuth(s.sshKeys))
	mux.HandleFunc("/api/v1/ssh/keys/add", s.requireAuth(s.sshKeyAdd))
	mux.HandleFunc("/api/v1/ssh/keys/delete", s.requireAuth(s.sshKeyDelete))
	mux.HandleFunc("/api/v1/github/summary", s.requireAuth(s.githubSummary))
	mux.HandleFunc("/api/v1/github/tag", s.requireAuth(s.githubCreateTag))
	mux.HandleFunc("/api/v1/github/rerun", s.requireAuth(s.githubRerunFailed))
	mux.HandleFunc("/api/v1/logs/system", s.requireAuth(s.systemLogs))
	mux.HandleFunc("/api/v1/audit", s.requireAuth(s.auditEvents))
	mux.HandleFunc("/api/v1/tools/run", s.requireAuth(s.runTool))
	mux.HandleFunc("/api/v1/settings", s.requireAuth(s.settings))
	mux.Handle("/", s.spaHandler())
	s.http = &http.Server{Addr: cfg.Listen, Handler: securityHeaders(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Minute, WriteTimeout: 10 * time.Minute, IdleTimeout: 60 * time.Second}
	return s, nil
}

func (s *Server) ListenAndServe() error {
	s.logger.Info("LukePanel listening", "address", s.cfg.Listen, "version", s.version)
	err := s.http.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "time": time.Now().UTC(), "version": s.version})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	ip := clientIP(r, s.cfg.TrustedProxy)
	allowed, retry := s.limiter.Allowed(ip)
	if !allowed {
		w.Header().Set("Retry-After", fmt.Sprintf("%.0f", retry.Seconds()))
		writeError(w, http.StatusTooManyRequests, "登录尝试过多，请稍后再试")
		return
	}
	var req struct{ Username, Password string }
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	valid, err := auth.VerifyPassword(req.Password, s.cfg.PasswordHash)
	if err != nil || req.Username != s.cfg.AdminUser || !valid {
		s.limiter.Fail(ip)
		s.audit.Write(AuditEvent{IP: ip, User: req.Username, Action: "auth.login", Result: "failed"})
		writeError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	s.limiter.Success(ip)
	token, session, err := s.sessions.Create(req.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法创建会话")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "lukepanel_session", Value: token, Path: "/", HttpOnly: true, Secure: s.cfg.SecureCookie, SameSite: http.SameSiteStrictMode, MaxAge: 86400})
	s.audit.Write(AuditEvent{IP: ip, User: req.Username, Action: "auth.login", Target: session.ID, Result: "success"})
	writeJSON(w, http.StatusOK, map[string]any{"username": req.Username, "csrf_token": session.CSRFToken})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	session, _ := sessionFromContext(r)
	cookie, _ := r.Cookie("lukepanel_session")
	if cookie != nil {
		s.sessions.Delete(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: "lukepanel_session", Value: "", Path: "/", HttpOnly: true, Secure: s.cfg.SecureCookie, SameSite: http.SameSiteStrictMode, MaxAge: -1})
	s.audit.Write(AuditEvent{IP: clientIP(r, s.cfg.TrustedProxy), User: session.Username, Action: "auth.logout", Target: session.ID, Result: "success"})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if decodeJSON(w, r, 8192, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	ip := clientIP(r, s.cfg.TrustedProxy)
	valid, err := auth.VerifyPassword(req.CurrentPassword, s.cfg.PasswordHash)
	if err != nil || !valid {
		s.audit.Write(AuditEvent{IP: ip, User: session.Username, Action: "auth.password.change", Result: "failed"})
		writeError(w, http.StatusUnauthorized, "当前密码错误")
		return
	}
	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusBadRequest, "新密码至少需要 12 个字符")
		return
	}
	s.configMu.Lock()
	updated := s.cfg
	updated.PasswordHash = newHash
	err = config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		s.logger.Error("password configuration update failed", "error", err)
		writeError(w, http.StatusInternalServerError, "密码保存失败")
		return
	}
	s.sessions.DeleteAllExcept(session.ID)
	s.audit.Write(AuditEvent{IP: ip, User: session.Username, Action: "auth.password.change", Result: "success"})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) elevate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	valid, err := auth.VerifyPassword(req.Password, s.cfg.PasswordHash)
	if err != nil || !valid {
		s.auditRequest(r, "auth.elevate", session.ID, "failed", "")
		writeError(w, http.StatusUnauthorized, "当前密码错误")
		return
	}
	s.elevatedMu.Lock()
	s.elevated[session.ID] = time.Now().Add(5 * time.Minute)
	s.elevatedMu.Unlock()
	s.auditRequest(r, "auth.elevate", session.ID, "success", "5m")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "expires_in": 300})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	session, _ := sessionFromContext(r)
	writeJSON(w, http.StatusOK, map[string]any{"username": session.Username, "csrf_token": session.CSRFToken, "session_id": session.ID})
}

func (s *Server) sessionManagement(w http.ResponseWriter, r *http.Request) {
	session, _ := sessionFromContext(r)
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"current": session.ID, "sessions": s.sessions.List()})
	case http.MethodDelete:
		count := s.sessions.DeleteAllExcept(session.ID)
		s.audit.Write(AuditEvent{IP: clientIP(r, s.cfg.TrustedProxy), User: session.Username, Action: "auth.sessions.revoke", Result: "success", Detail: strconv.Itoa(count)})
		writeJSON(w, http.StatusOK, map[string]int{"revoked": count})
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) overview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	data, err := s.collector.Collect()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法读取系统状态")
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (s *Server) overviewStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusNotImplemented, "当前环境不支持实时推送")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	send := func() error {
		data, err := s.collector.Collect()
		if err != nil {
			return err
		}
		payload, err := json.Marshal(data)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "event: overview\ndata: %s\n\n", payload); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}
	if err := send(); err != nil {
		return
	}
	ticker := time.NewTicker(2 * time.Second)
	keepAlive := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	defer keepAlive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			if err := send(); err != nil {
				return
			}
		case <-keepAlive.C:
			if _, err := io.WriteString(w, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (s *Server) serviceList(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/services", url.Values{"query": {r.URL.Query().Get("query")}}), nil, "")
}
func (s *Server) serviceLogs(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/services/logs", url.Values{"name": {r.URL.Query().Get("name")}, "lines": {r.URL.Query().Get("lines")}}), nil, "")
}
func (s *Server) serviceAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if req["action"] != "start" && !s.requireElevation(w, r) {
		return
	}
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/services/action", req, nil); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "service."+req["action"], req["name"], "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) processList(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/processes", nil, "")
}
func (s *Server) processAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		PID    int    `json:"pid"`
		Signal string `json:"signal"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/processes/action", req, nil); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "process."+req.Signal, strconv.Itoa(req.PID), "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) networkInfo(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/network", nil, "")
}
func (s *Server) storageInfo(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/storage", nil, "")
}
func (s *Server) timerInfo(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/timers", nil, "")
}
func (s *Server) updateInfo(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/updates", nil, "")
}
func (s *Server) dockerStatus(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/status", nil, "")
}
func (s *Server) dockerContainers(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/containers", nil, "")
}
func (s *Server) dockerLogs(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/docker/logs", url.Values{"id": {r.URL.Query().Get("id")}, "tail": {r.URL.Query().Get("tail")}}), nil, "")
}
func (s *Server) dockerAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if req["action"] != "start" && !s.requireElevation(w, r) {
		return
	}
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/docker/action", req, nil); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "docker."+req["action"], req["id"], "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) dockerCompose(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/compose", nil, "")
}
func (s *Server) dockerComposeAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/docker/compose/action", req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "docker.compose."+req["action"], req["project"], "success", "")
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) dockerImages(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/images", nil, "")
}
func (s *Server) dockerNetworks(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/networks", nil, "")
}
func (s *Server) dockerVolumes(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/volumes", nil, "")
}
func (s *Server) dockerImagePull(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/docker/images/pull", req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "docker.image.pull", req["reference"], "success", "")
	writeJSON(w, http.StatusOK, out)
}
func (s *Server) dockerImageDelete(w http.ResponseWriter, r *http.Request) {
	s.dockerResourceMutation(w, r, "/v1/docker/images/delete", "docker.image.delete", "id")
}
func (s *Server) dockerNetworkDelete(w http.ResponseWriter, r *http.Request) {
	s.dockerResourceMutation(w, r, "/v1/docker/networks/delete", "docker.network.delete", "id")
}
func (s *Server) dockerVolumeDelete(w http.ResponseWriter, r *http.Request) {
	s.dockerResourceMutation(w, r, "/v1/docker/volumes/delete", "docker.volume.delete", "name")
}
func (s *Server) dockerResourceMutation(w http.ResponseWriter, r *http.Request, endpoint, action, key string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.agent.JSON(r.Context(), http.MethodPost, endpoint, req, nil); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, action, req[key], "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) files(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/files", url.Values{"path": {r.URL.Query().Get("path")}}), nil, "files.list")
}
func (s *Server) fileContent(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/files/content", url.Values{"path": {r.URL.Query().Get("path")}}), nil, "files.read")
	case http.MethodPut:
		var req map[string]string
		if decodeJSON(w, r, (2<<20)+(64<<10), &req) != nil {
			return
		}
		if !s.requireElevation(w, r) {
			return
		}
		if err := s.agent.JSON(r.Context(), http.MethodPut, "/v1/files/content", req, nil); err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		s.auditRequest(r, "files.write", req["path"], "success", "")
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}
func (s *Server) fileCreate(w http.ResponseWriter, r *http.Request) {
	s.fileMutation(w, r, "/v1/files/create", "files.create")
}
func (s *Server) fileMkdir(w http.ResponseWriter, r *http.Request) {
	s.fileMutation(w, r, "/v1/files/mkdir", "files.mkdir")
}
func (s *Server) fileRename(w http.ResponseWriter, r *http.Request) {
	s.fileMutation(w, r, "/v1/files/rename", "files.rename")
}
func (s *Server) fileDelete(w http.ResponseWriter, r *http.Request) {
	s.fileMutation(w, r, "/v1/files/delete", "files.delete")
}
func (s *Server) fileMutation(w http.ResponseWriter, r *http.Request, endpoint, action string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, endpoint, req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	target := req["path"]
	if target == "" {
		target = req["source"]
	}
	s.auditRequest(r, action, target, "success", "")
	writeJSON(w, http.StatusOK, out)
}
func (s *Server) fileCopy(w http.ResponseWriter, r *http.Request) {
	s.fileMutation(w, r, "/v1/files/copy", "files.copy")
}
func (s *Server) fileMove(w http.ResponseWriter, r *http.Request) {
	s.fileMutation(w, r, "/v1/files/move", "files.move")
}
func (s *Server) fileChmod(w http.ResponseWriter, r *http.Request) {
	s.fileMutation(w, r, "/v1/files/chmod", "files.chmod")
}
func (s *Server) fileRecycle(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s.proxyAgentJSON(w, r, http.MethodGet, "/v1/files/recycle", nil, "")
		return
	}
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/files/recycle", req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "files.recycle."+req["action"], req["id"], "success", "")
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) fileDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	endpoint := agent.Query("/v1/files/download", url.Values{"path": {r.URL.Query().Get("path")}})
	resp, err := s.agent.Raw(r.Context(), http.MethodGet, endpoint, nil, "")
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		s.copyAgentError(w, resp)
		return
	}
	for _, name := range []string{"Content-Type", "Content-Disposition", "Content-Length"} {
		if value := resp.Header.Get(name); value != "" {
			w.Header().Set(name, value)
		}
	}
	s.auditRequest(r, "files.download", r.URL.Query().Get("path"), "success", "")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}
func (s *Server) fileUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	resp, err := s.agent.Raw(r.Context(), http.MethodPost, "/v1/files/upload", r.Body, r.Header.Get("Content-Type"))
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		s.copyAgentError(w, resp)
		return
	}
	var out map[string]any
	if json.NewDecoder(resp.Body).Decode(&out) != nil {
		writeError(w, http.StatusBadGateway, "上传响应异常")
		return
	}
	s.auditRequest(r, "files.upload", fmt.Sprint(out["path"]), "success", "")
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) sshStatus(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/ssh/status", nil, "")
}
func (s *Server) sshUsers(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/ssh/users", nil, "")
}
func (s *Server) sshKeys(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/ssh/keys", url.Values{"user": {r.URL.Query().Get("user")}}), nil, "")
}
func (s *Server) sshKeyAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 1<<20, &req) != nil {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/ssh/keys/add", req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "ssh.key.add", req["user"], "success", "")
	writeJSON(w, http.StatusOK, out)
}
func (s *Server) sshKeyDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]string
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/ssh/keys/delete", req, nil); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "ssh.key.delete", req["user"]+":"+req["id"], "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) githubSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	owner, repo := r.URL.Query().Get("owner"), r.URL.Query().Get("repo")
	summary, err := s.github.Summary(r.Context(), owner, repo, "")
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "无法连接 GitHub API") {
			status = http.StatusBadGateway
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, summary)
}
func (s *Server) githubCreateTag(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct{ Owner, Repo, Tag, TargetSHA, Token string }
	if decodeJSON(w, r, 64<<10, &req) != nil {
		return
	}
	if !s.cfg.SecureCookie {
		writeError(w, http.StatusBadRequest, "必须通过 HTTPS 使用 GitHub Token")
		return
	}
	if err := s.github.CreateTag(r.Context(), req.Owner, req.Repo, req.Tag, req.TargetSHA, req.Token); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "无法连接 GitHub API") {
			status = http.StatusBadGateway
		}
		writeError(w, status, err.Error())
		return
	}
	s.auditRequest(r, "github.tag.create", req.Owner+"/"+req.Repo+":"+req.Tag, "success", "token not stored")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) githubRerunFailed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		Owner string `json:"owner"`
		Repo  string `json:"repo"`
		RunID int64  `json:"run_id"`
		Token string `json:"token"`
	}
	if decodeJSON(w, r, 64<<10, &req) != nil {
		return
	}
	if !s.cfg.SecureCookie {
		writeError(w, http.StatusBadRequest, "必须通过 HTTPS 使用 GitHub Token")
		return
	}
	if err := s.github.RerunFailedJobs(r.Context(), req.Owner, req.Repo, req.RunID, req.Token); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "无法连接 GitHub API") {
			status = http.StatusBadGateway
		}
		writeError(w, status, err.Error())
		return
	}
	s.auditRequest(r, "github.actions.rerun_failed", fmt.Sprintf("%s/%s#%d", req.Owner, req.Repo, req.RunID), "success", "token not stored")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) systemLogs(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/logs/system", url.Values{"unit": {r.URL.Query().Get("unit")}, "priority": {r.URL.Query().Get("priority")}, "lines": {r.URL.Query().Get("lines")}}), nil, "logs.read")
}
func (s *Server) auditEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	events, err := s.audit.Read(parseInt(r.URL.Query().Get("limit"), 300))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法读取审计日志")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}
func (s *Server) runTool(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Tool, Target string
		Port         int
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	result, err := tools.Run(r.Context(), req.Tool, req.Target, req.Port)
	status := "success"
	if err != nil {
		status = "failed"
		if result.Output == "" {
			writeError(w, http.StatusBadRequest, err.Error())
			s.auditRequest(r, "tools."+req.Tool, req.Target, status, err.Error())
			return
		}
	}
	s.auditRequest(r, "tools."+req.Tool, req.Target, status, "")
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) settings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.configMu.RLock()
		cfg := s.cfg
		s.configMu.RUnlock()
		writeJSON(w, http.StatusOK, map[string]any{"version": s.version, "listen": cfg.Listen, "secure_cookie": cfg.SecureCookie, "auto_refresh_seconds": cfg.AutoRefreshSeconds, "allowed_roots": cfg.AllowedRoots, "agent_socket": cfg.AgentSocket})
	case http.MethodPatch:
		var req struct {
			AutoRefreshSeconds int `json:"auto_refresh_seconds"`
		}
		if decodeJSON(w, r, 4096, &req) != nil {
			return
		}
		if req.AutoRefreshSeconds < 2 || req.AutoRefreshSeconds > 300 {
			writeError(w, http.StatusBadRequest, "刷新间隔必须在 2–300 秒之间")
			return
		}
		s.configMu.Lock()
		updated := s.cfg
		updated.AutoRefreshSeconds = req.AutoRefreshSeconds
		err := config.Save(s.configPath, updated)
		if err == nil {
			s.cfg = updated
		}
		s.configMu.Unlock()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "设置保存失败")
			return
		}
		s.auditRequest(r, "settings.update", "auto_refresh_seconds", "success", strconv.Itoa(req.AutoRefreshSeconds))
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) proxyAgentJSON(w http.ResponseWriter, r *http.Request, method, endpoint string, body any, auditAction string) {
	if r.Method != method {
		methodNotAllowed(w)
		return
	}
	var raw json.RawMessage
	if err := s.agent.JSON(r.Context(), method, endpoint, body, &raw); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	if auditAction != "" {
		s.auditRequest(r, auditAction, r.URL.Query().Get("path"), "success", "")
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}
func (s *Server) copyAgentError(w http.ResponseWriter, resp *http.Response) {
	var payload map[string]string
	if json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&payload) == nil && payload["error"] != "" {
		writeError(w, resp.StatusCode, payload["error"])
		return
	}
	writeError(w, resp.StatusCode, "Agent 请求失败")
}
func (s *Server) auditRequest(r *http.Request, action, target, result, detail string) {
	session, _ := sessionFromContext(r)
	s.audit.Write(AuditEvent{IP: clientIP(r, s.cfg.TrustedProxy), User: session.Username, Action: action, Target: target, Result: result, Detail: detail})
}

func (s *Server) requireElevation(w http.ResponseWriter, r *http.Request) bool {
	session, _ := sessionFromContext(r)
	s.elevatedMu.Lock()
	expires := s.elevated[session.ID]
	if !expires.IsZero() && time.Now().After(expires) {
		delete(s.elevated, session.ID)
		expires = time.Time{}
	}
	s.elevatedMu.Unlock()
	if expires.IsZero() {
		writeError(w, http.StatusForbidden, "需要二次验证后执行此操作")
		return false
	}
	return true
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("lukepanel_session")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "未登录")
			return
		}
		session, ok := s.sessions.Get(cookie.Value)
		if !ok {
			writeError(w, http.StatusUnauthorized, "会话已过期")
			return
		}
		if r.Method != http.MethodGet && r.Header.Get("X-CSRF-Token") != session.CSRFToken {
			writeError(w, http.StatusForbidden, "CSRF 校验失败")
			return
		}
		next(w, r.WithContext(withSession(r.Context(), session)))
	}
}
func (s *Server) spaHandler() http.Handler {
	dist, _ := fs.Sub(webAssets, "webdist")
	fileServer := http.FileServer(http.FS(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		clean := path.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		if clean == "." {
			clean = "index.html"
		}
		if _, err := fs.Stat(dist, clean); err != nil {
			r.URL.Path = "/index.html"
		}
		fileServer.ServeHTTP(w, r)
	})
}
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'")
		next.ServeHTTP(w, r)
	})
}
func clientIP(r *http.Request, trusted string) string {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if trusted != "" && host == trusted {
		if x := r.Header.Get("X-Forwarded-For"); x != "" {
			return strings.TrimSpace(strings.Split(x, ",")[0])
		}
	}
	return host
}
func decodeJSON(w http.ResponseWriter, r *http.Request, max int64, out any) error {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, max)).Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return err
	}
	return nil
}
func parseInt(value string, fallback int) int {
	n, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return n
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
func methodNotAllowed(w http.ResponseWriter) {
	writeError(w, http.StatusMethodNotAllowed, "方法不允许")
}
