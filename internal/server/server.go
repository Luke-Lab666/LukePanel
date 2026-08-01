package server

import (
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
	"github.com/Luke-Lab666/LukePanel/internal/config"
	filebrowser "github.com/Luke-Lab666/LukePanel/internal/files"
	"github.com/Luke-Lab666/LukePanel/internal/system"
)

//go:embed webdist/*
var webAssets embed.FS

type Server struct {
	cfg        config.Config
	configPath string
	configMu   sync.Mutex
	http       *http.Server
	collector  *system.Collector
	browser    *filebrowser.Browser
	sessions   *auth.Store
	limiter    *auth.LoginLimiter
	audit      *AuditLog
	logger     *slog.Logger
}

func New(cfg config.Config, configPath string, logger *slog.Logger) (*Server, error) {
	browser, err := filebrowser.NewBrowser(cfg.AllowedRoots)
	if err != nil {
		return nil, err
	}
	s := &Server{cfg: cfg, configPath: configPath, collector: system.NewCollector(), browser: browser, sessions: auth.NewStore(cfg.SessionSecret, 24*time.Hour), limiter: auth.NewLoginLimiter(), audit: NewAuditLog(cfg.DataDir), logger: logger}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/health", s.health)
	mux.HandleFunc("/api/v1/auth/login", s.login)
	mux.HandleFunc("/api/v1/auth/logout", s.requireAuth(s.logout))
	mux.HandleFunc("/api/v1/auth/password", s.requireAuth(s.changePassword))
	mux.HandleFunc("/api/v1/auth/me", s.requireAuth(s.me))
	mux.HandleFunc("/api/v1/system/overview", s.requireAuth(s.overview))
	mux.HandleFunc("/api/v1/files", s.requireAuth(s.files))
	mux.Handle("/", s.spaHandler())
	s.http = &http.Server{Addr: cfg.Listen, Handler: securityHeaders(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	return s, nil
}

func (s *Server) ListenAndServe() error {
	s.logger.Info("LukePanel listening", "address", s.cfg.Listen)
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
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "time": time.Now().UTC()})
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	ip := clientIP(r, s.cfg.TrustedProxy)
	allowed, retry := s.limiter.Allowed(ip)
	if !allowed {
		w.Header().Set("Retry-After", retry.Round(time.Second).String())
		writeError(w, http.StatusTooManyRequests, "登录尝试过多，请稍后再试")
		return
	}
	var req struct{ Username, Password string }
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req) != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
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
	s.audit.Write(AuditEvent{IP: ip, User: req.Username, Action: "auth.login", Result: "success"})
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
	s.audit.Write(AuditEvent{IP: clientIP(r, s.cfg.TrustedProxy), User: session.Username, Action: "auth.logout", Result: "success"})
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
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&req) != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
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
	s.audit.Write(AuditEvent{IP: ip, User: session.Username, Action: "auth.password.change", Result: "success"})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	session, _ := sessionFromContext(r)
	writeJSON(w, http.StatusOK, map[string]any{"username": session.Username, "csrf_token": session.CSRFToken})
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
func (s *Server) files(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	listing, err := s.browser.List(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	session, _ := sessionFromContext(r)
	s.audit.Write(AuditEvent{IP: clientIP(r, s.cfg.TrustedProxy), User: session.Username, Action: "files.list", Target: listing.Path, Result: "success"})
	writeJSON(w, http.StatusOK, listing)
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
