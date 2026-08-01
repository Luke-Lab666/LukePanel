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
	"regexp"
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
	cfg            config.Config
	configPath     string
	version        string
	configMu       sync.RWMutex
	http           *http.Server
	collector      *system.Collector
	agent          *agent.Client
	github         *githubhelper.Client
	githubImporter *githubhelper.Importer
	githubMu       sync.Mutex
	githubTokens   map[string]githubCredential
	githubFlows    map[string]*githubDeviceFlow
	sessions       *auth.Store
	limiter        *auth.LoginLimiter
	audit          *AuditLog
	logger         *slog.Logger
	elevatedMu     sync.Mutex
	elevated       map[string]time.Time
	totpMu         sync.Mutex
	totpPending    map[string]totpPendingSetup
}

func New(cfg config.Config, configPath, version string, logger *slog.Logger) (*Server, error) {
	githubClient := githubhelper.New()
	s := &Server{
		cfg: cfg, configPath: configPath, version: version, collector: system.NewCollector(),
		agent: agent.NewClient(cfg.AgentSocket, cfg.AgentSecret), github: githubClient, githubImporter: githubhelper.NewImporter(githubClient, cfg.DataDir), sessions: auth.NewStore(cfg.SessionSecret, 24*time.Hour),
		limiter: auth.NewLoginLimiter(), audit: NewAuditLog(cfg.DataDir), logger: logger, elevated: make(map[string]time.Time),
		githubTokens: make(map[string]githubCredential), githubFlows: make(map[string]*githubDeviceFlow),
		totpPending: make(map[string]totpPendingSetup),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/health", s.health)
	mux.HandleFunc("/api/v1/auth/login", s.login)
	mux.HandleFunc("/api/v1/auth/logout", s.requireAuth(s.logout))
	mux.HandleFunc("/api/v1/auth/password", s.requireAuth(s.changePassword))
	mux.HandleFunc("/api/v1/auth/account", s.requireAuth(s.changeAccount))
	mux.HandleFunc("/api/v1/auth/elevate", s.requireAuth(s.elevate))
	mux.HandleFunc("/api/v1/auth/me", s.requireAuth(s.me))
	mux.HandleFunc("/api/v1/auth/sessions", s.requireAuth(s.sessionManagement))
	mux.HandleFunc("/api/v1/auth/totp/status", s.requireAuth(s.totpStatus))
	mux.HandleFunc("/api/v1/auth/totp/setup", s.requireAuth(s.totpSetup))
	mux.HandleFunc("/api/v1/auth/totp/confirm", s.requireAuth(s.totpConfirm))
	mux.HandleFunc("/api/v1/auth/totp/disable", s.requireAuth(s.totpDisable))
	mux.HandleFunc("/api/v1/auth/totp/recovery", s.requireAuth(s.totpRegenerateRecovery))
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
	mux.HandleFunc("/api/v1/system/tasks", s.requireAuth(s.taskList))
	mux.HandleFunc("/api/v1/system/tasks/create", s.requireAuth(s.taskCreate))
	mux.HandleFunc("/api/v1/system/tasks/action", s.requireAuth(s.taskAction))
	mux.HandleFunc("/api/v1/system/updates", s.requireAuth(s.updateInfo))
	mux.HandleFunc("/api/v1/docker/status", s.requireAuth(s.dockerStatus))
	mux.HandleFunc("/api/v1/docker/install", s.requireAuth(s.dockerInstall))
	mux.HandleFunc("/api/v1/docker/containers", s.requireAuth(s.dockerContainers))
	mux.HandleFunc("/api/v1/docker/stats", s.requireAuth(s.dockerStats))
	mux.HandleFunc("/api/v1/docker/action", s.requireAuth(s.dockerAction))
	mux.HandleFunc("/api/v1/docker/logs", s.requireAuth(s.dockerLogs))
	mux.HandleFunc("/api/v1/docker/inspect", s.requireAuth(s.dockerInspect))
	mux.HandleFunc("/api/v1/docker/recreate", s.requireAuth(s.dockerRecreate))
	mux.HandleFunc("/api/v1/docker/images", s.requireAuth(s.dockerImages))
	mux.HandleFunc("/api/v1/docker/images/pull", s.requireAuth(s.dockerImagePull))
	mux.HandleFunc("/api/v1/docker/images/delete", s.requireAuth(s.dockerImageDelete))
	mux.HandleFunc("/api/v1/docker/networks", s.requireAuth(s.dockerNetworks))
	mux.HandleFunc("/api/v1/docker/networks/create", s.requireAuth(s.dockerNetworkCreate))
	mux.HandleFunc("/api/v1/docker/networks/delete", s.requireAuth(s.dockerNetworkDelete))
	mux.HandleFunc("/api/v1/docker/volumes", s.requireAuth(s.dockerVolumes))
	mux.HandleFunc("/api/v1/docker/volumes/create", s.requireAuth(s.dockerVolumeCreate))
	mux.HandleFunc("/api/v1/docker/volumes/delete", s.requireAuth(s.dockerVolumeDelete))
	mux.HandleFunc("/api/v1/docker/cleanup/preview", s.requireAuth(s.dockerCleanupPreview))
	mux.HandleFunc("/api/v1/docker/cleanup", s.requireAuth(s.dockerCleanup))
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
	mux.HandleFunc("/api/v1/files/archive/extract", s.requireAuth(s.fileArchiveExtract))
	mux.HandleFunc("/api/v1/files/copy", s.requireAuth(s.fileCopy))
	mux.HandleFunc("/api/v1/files/move", s.requireAuth(s.fileMove))
	mux.HandleFunc("/api/v1/files/chmod", s.requireAuth(s.fileChmod))
	mux.HandleFunc("/api/v1/files/recycle", s.requireAuth(s.fileRecycle))
	mux.HandleFunc("/api/v1/files/backups", s.requireAuth(s.fileBackups))
	mux.HandleFunc("/api/v1/files/backups/diff", s.requireAuth(s.fileBackupDiff))
	mux.HandleFunc("/api/v1/files/backups/restore", s.requireAuth(s.fileBackupRestore))
	mux.HandleFunc("/api/v1/ssh/status", s.requireAuth(s.sshStatus))
	mux.HandleFunc("/api/v1/ssh/users", s.requireAuth(s.sshUsers))
	mux.HandleFunc("/api/v1/ssh/keys", s.requireAuth(s.sshKeys))
	mux.HandleFunc("/api/v1/ssh/keys/add", s.requireAuth(s.sshKeyAdd))
	mux.HandleFunc("/api/v1/ssh/keys/delete", s.requireAuth(s.sshKeyDelete))
	mux.HandleFunc("/api/v1/ssh/keys/generate", s.requireAuth(s.sshKeyGenerate))
	mux.HandleFunc("/api/v1/ssh/password", s.requireAuth(s.sshPassword))
	mux.HandleFunc("/api/v1/security/status", s.requireAuth(s.securityStatus))
	mux.HandleFunc("/api/v1/security/fail2ban/install", s.requireAuth(s.fail2banInstall))
	mux.HandleFunc("/api/v1/security/auto-updates/enable", s.requireAuth(s.autoUpdatesEnable))
	mux.HandleFunc("/api/v1/github/auth/status", s.requireAuth(s.githubAuthStatus))
	mux.HandleFunc("/api/v1/github/auth/device/start", s.requireAuth(s.githubDeviceStart))
	mux.HandleFunc("/api/v1/github/auth/device/poll", s.requireAuth(s.githubDevicePoll))
	mux.HandleFunc("/api/v1/github/auth/disconnect", s.requireAuth(s.githubDisconnect))
	mux.HandleFunc("/api/v1/github/import/preview", s.requireAuth(s.githubImportPreview))
	mux.HandleFunc("/api/v1/github/import/commit", s.requireAuth(s.githubImportCommit))
	mux.HandleFunc("/api/v1/github/summary", s.requireAuth(s.githubSummary))
	mux.HandleFunc("/api/v1/github/tag", s.requireAuth(s.githubCreateTag))
	mux.HandleFunc("/api/v1/github/branch", s.requireAuth(s.githubCreateBranch))
	mux.HandleFunc("/api/v1/github/pull", s.requireAuth(s.githubCreatePullRequest))
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
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		OTP      string `json:"otp"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	s.configMu.RLock()
	passwordHash, adminUser, totpEnabled := s.cfg.PasswordHash, s.cfg.AdminUser, s.cfg.TOTPSecret != ""
	s.configMu.RUnlock()
	valid, err := auth.VerifyPassword(req.Password, passwordHash)
	if err != nil || req.Username != adminUser || !valid {
		s.limiter.Fail(ip)
		s.audit.Write(AuditEvent{IP: ip, User: req.Username, Action: "auth.login", Result: "failed"})
		writeError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	if totpEnabled {
		if isSecondFactorMissing(req.OTP) {
			writeErrorCode(w, http.StatusUnauthorized, "请输入身份验证器验证码或恢复码", "totp_required")
			return
		}
		ok, recoveryUsed, verifyErr := s.verifySecondFactor(req.OTP, true)
		if verifyErr != nil || !ok {
			s.limiter.Fail(ip)
			s.audit.Write(AuditEvent{IP: ip, User: req.Username, Action: "auth.login.totp", Result: "failed"})
			writeErrorCode(w, http.StatusUnauthorized, "验证码或恢复码不正确", "totp_invalid")
			return
		}
		if recoveryUsed {
			s.audit.Write(AuditEvent{IP: ip, User: req.Username, Action: "auth.login.recovery", Result: "success"})
		}
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
	s.clearGitHubSession(session.ID)
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
	s.configMu.RLock()
	adminUser := s.cfg.AdminUser
	s.configMu.RUnlock()
	if err := auth.ValidatePasswordStrength(req.NewPassword, adminUser); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
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

var accountNamePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_.-]{2,31}$`)

func (s *Server) changeAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		methodNotAllowed(w)
		return
	}
	var req struct {
		CurrentPassword string `json:"current_password"`
		Username        string `json:"username"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if !accountNamePattern.MatchString(req.Username) {
		writeError(w, http.StatusBadRequest, "用户名需以字母开头，长度 3–32，只能包含字母、数字、点、下划线或短横线")
		return
	}
	s.configMu.RLock()
	passwordHash, oldUser := s.cfg.PasswordHash, s.cfg.AdminUser
	s.configMu.RUnlock()
	valid, err := auth.VerifyPassword(req.CurrentPassword, passwordHash)
	if err != nil || !valid {
		writeError(w, http.StatusUnauthorized, "当前密码错误")
		return
	}
	if req.Username == oldUser {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "username": oldUser, "revoked": 0})
		return
	}
	s.configMu.Lock()
	updated := s.cfg
	updated.AdminUser = req.Username
	err = config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "用户名保存失败")
		return
	}
	session, _ := sessionFromContext(r)
	revoked := s.sessions.RenameCurrentAndDeleteOthers(session.ID, req.Username)
	s.configMu.RLock()
	trustedProxy := s.cfg.TrustedProxy
	s.configMu.RUnlock()
	s.audit.Write(AuditEvent{IP: clientIP(r, trustedProxy), User: oldUser, Action: "auth.username.change", Target: req.Username, Result: "success", Detail: fmt.Sprintf("revoked=%d", revoked)})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "username": req.Username, "revoked": revoked})
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
func (s *Server) taskList(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/tasks", nil, "")
}
func (s *Server) taskCreate(w http.ResponseWriter, r *http.Request) {
	s.dockerJSONMutation(w, r, "/v1/tasks/create", "tasks.create", "name", 32<<10)
}
func (s *Server) taskAction(w http.ResponseWriter, r *http.Request) {
	s.dockerJSONMutation(w, r, "/v1/tasks/action", "tasks.action", "id", 16<<10)
}
func (s *Server) updateInfo(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/updates", nil, "")
}
func (s *Server) dockerStatus(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/status", nil, "")
}
func (s *Server) dockerInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/docker/install", map[string]any{}, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "docker.install", "docker.io", "success", "")
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) dockerContainers(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/containers", nil, "")
}
func (s *Server) dockerStats(w http.ResponseWriter, r *http.Request) {
	query := url.Values{}
	for _, id := range r.URL.Query()["id"] {
		query.Add("id", id)
	}
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/docker/stats", query), nil, "")
}
func (s *Server) dockerLogs(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/docker/logs", url.Values{"id": {r.URL.Query().Get("id")}, "tail": {r.URL.Query().Get("tail")}}), nil, "")
}
func (s *Server) dockerInspect(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/docker/inspect", url.Values{"id": {r.URL.Query().Get("id")}}), nil, "docker.inspect")
}

func (s *Server) dockerRecreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]any
	if decodeJSON(w, r, 2<<20, &req) != nil {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/docker/recreate", req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "docker.recreate", fmt.Sprint(req["id"]), "success", fmt.Sprint(out["name"]))
	writeJSON(w, http.StatusOK, out)
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
func (s *Server) dockerNetworkCreate(w http.ResponseWriter, r *http.Request) {
	s.dockerJSONMutation(w, r, "/v1/docker/networks/create", "docker.network.create", "name", 32<<10)
}
func (s *Server) dockerVolumes(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/volumes", nil, "")
}
func (s *Server) dockerVolumeCreate(w http.ResponseWriter, r *http.Request) {
	s.dockerJSONMutation(w, r, "/v1/docker/volumes/create", "docker.volume.create", "name", 16<<10)
}
func (s *Server) dockerCleanupPreview(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, "/v1/docker/cleanup/preview", nil, "")
}
func (s *Server) dockerCleanup(w http.ResponseWriter, r *http.Request) {
	s.dockerJSONMutation(w, r, "/v1/docker/cleanup", "docker.cleanup", "mode", 16<<10)
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

func (s *Server) dockerJSONMutation(w http.ResponseWriter, r *http.Request, endpoint, action, key string, limit int64) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req map[string]any
	if decodeJSON(w, r, limit, &req) != nil {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, endpoint, req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, action, fmt.Sprint(req[key]), "success", "")
	writeJSON(w, http.StatusOK, out)
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

func (s *Server) fileBackups(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/files/backups", url.Values{"path": {r.URL.Query().Get("path")}}), nil, "files.backups.list")
}

func (s *Server) fileBackupDiff(w http.ResponseWriter, r *http.Request) {
	s.proxyAgentJSON(w, r, http.MethodGet, agent.Query("/v1/files/backups/diff", url.Values{"path": {r.URL.Query().Get("path")}, "id": {r.URL.Query().Get("id")}}), nil, "files.backups.diff")
}

func (s *Server) fileBackupRestore(w http.ResponseWriter, r *http.Request) {
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
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/files/backups/restore", req, nil); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "files.backups.restore", req["path"], "success", req["id"])
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
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

func (s *Server) fileArchiveExtract(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	resp, err := s.agent.Raw(r.Context(), http.MethodPost, "/v1/files/archive/extract", r.Body, r.Header.Get("Content-Type"))
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
		writeError(w, http.StatusBadGateway, "解压响应异常")
		return
	}
	s.auditRequest(r, "files.archive.extract", fmt.Sprint(out["files"]), "success", "zip")
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

func (s *Server) sshKeyGenerate(w http.ResponseWriter, r *http.Request) {
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
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/ssh/keys/generate", req, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "ssh.key.generate", req["user"], "success", "private key returned once")
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) sshPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/ssh/password", req, nil); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	action := "disable"
	if req.Enabled {
		action = "enable"
	}
	s.auditRequest(r, "ssh.password."+action, "sshd", "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) securityStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	s.configMu.RLock()
	payload := map[string]any{"listen": s.cfg.Listen, "secure_cookie": s.cfg.SecureCookie, "totp_enabled": s.cfg.TOTPSecret != ""}
	s.configMu.RUnlock()
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/security/status", payload, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) autoUpdatesEnable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/security/auto-updates/enable", map[string]any{}, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "security.auto_updates.enable", "apt", "success", "no automatic reboot")
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) fail2banInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	s.configMu.RLock()
	trustedProxy := s.cfg.TrustedProxy
	s.configMu.RUnlock()
	payload := map[string]string{"current_ip": clientIP(r, trustedProxy)}
	var out map[string]any
	if err := s.agent.JSON(r.Context(), http.MethodPost, "/v1/security/fail2ban/install", payload, &out); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.auditRequest(r, "security.fail2ban.install", payload["current_ip"], "success", "current IP ignored")
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) githubSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	owner, repo := r.URL.Query().Get("owner"), r.URL.Query().Get("repo")
	session, _ := sessionFromContext(r)
	summary, err := s.github.Summary(r.Context(), owner, repo, s.githubToken(session.ID))
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
	session, _ := sessionFromContext(r)
	token := strings.TrimSpace(req.Token)
	if token == "" {
		token = s.githubToken(session.ID)
	}
	if err := s.github.CreateTag(r.Context(), req.Owner, req.Repo, req.Tag, req.TargetSHA, token); err != nil {
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

func (s *Server) githubCreateBranch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		Owner  string `json:"owner"`
		Repo   string `json:"repo"`
		Name   string `json:"name"`
		Source string `json:"source"`
	}
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	branch, err := s.github.CreateBranch(r.Context(), req.Owner, req.Repo, req.Name, req.Source, s.githubToken(session.ID))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.auditRequest(r, "github.branch.create", req.Owner+"/"+req.Repo+":"+branch.Name, "success", branch.SHA)
	writeJSON(w, http.StatusOK, branch)
}

func (s *Server) githubCreatePullRequest(w http.ResponseWriter, r *http.Request) {
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
		Title string `json:"title"`
		Body  string `json:"body"`
		Head  string `json:"head"`
		Base  string `json:"base"`
	}
	if decodeJSON(w, r, 64<<10, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	pull, err := s.github.CreatePullRequest(r.Context(), req.Owner, req.Repo, req.Title, req.Body, req.Head, req.Base, s.githubToken(session.ID))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.auditRequest(r, "github.pull.create", fmt.Sprintf("%s/%s#%d", req.Owner, req.Repo, pull.Number), "success", pull.Head+" -> "+pull.Base)
	writeJSON(w, http.StatusOK, pull)
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
	session, _ := sessionFromContext(r)
	token := strings.TrimSpace(req.Token)
	if token == "" {
		token = s.githubToken(session.ID)
	}
	if err := s.github.RerunFailedJobs(r.Context(), req.Owner, req.Repo, req.RunID, token); err != nil {
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
		writeJSON(w, http.StatusOK, map[string]any{"version": s.version, "listen": cfg.Listen, "secure_cookie": cfg.SecureCookie, "auto_refresh_seconds": cfg.AutoRefreshSeconds, "allowed_roots": cfg.AllowedRoots, "agent_socket": cfg.AgentSocket, "admin_user": cfg.AdminUser})
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
	s.configMu.RLock()
	trustedProxy := s.cfg.TrustedProxy
	s.configMu.RUnlock()
	s.audit.Write(AuditEvent{IP: clientIP(r, trustedProxy), User: session.Username, Action: action, Target: target, Result: result, Detail: detail})
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
		if site := strings.ToLower(r.Header.Get("Sec-Fetch-Site")); site == "cross-site" {
			writeError(w, http.StatusForbidden, "拒绝跨站请求")
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
	index, _ := fs.ReadFile(dist, "index.html")
	serveIndex := func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(index)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		clean := path.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		if clean == "." || clean == "index.html" {
			serveIndex(w)
			return
		}
		if _, err := fs.Stat(dist, clean); err != nil {
			serveIndex(w)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("X-Permitted-Cross-Domain-Policies", "none")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Pragma", "no-cache")
		}
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
func writeErrorCode(w http.ResponseWriter, status int, message, code string) {
	writeJSON(w, status, map[string]string{"error": message, "code": code})
}
func methodNotAllowed(w http.ResponseWriter) {
	writeError(w, http.StatusMethodNotAllowed, "方法不允许")
}
