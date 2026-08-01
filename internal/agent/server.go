package agent

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/aptadmin"
	"github.com/Luke-Lab666/LukePanel/internal/config"
	"github.com/Luke-Lab666/LukePanel/internal/dockerapi"
	filemanager "github.com/Luke-Lab666/LukePanel/internal/files"
	"github.com/Luke-Lab666/LukePanel/internal/hostadmin"
	"github.com/Luke-Lab666/LukePanel/internal/services"
	"github.com/Luke-Lab666/LukePanel/internal/snapshots"
	"github.com/Luke-Lab666/LukePanel/internal/sshadmin"
	"github.com/Luke-Lab666/LukePanel/internal/systemadmin"
	"github.com/Luke-Lab666/LukePanel/internal/tasks"
)

type Server struct {
	cfg       config.Config
	logger    *slog.Logger
	docker    *dockerapi.Client
	services  *services.Manager
	files     *filemanager.Manager
	processes *systemadmin.ProcessManager
	ssh       *sshadmin.Manager
	tasks     *tasks.Manager
	snapshots *snapshots.Manager
	apt       *aptadmin.Manager
	http      *http.Server
}

func NewServer(cfg config.Config, logger *slog.Logger) (*Server, error) {
	fm, err := filemanager.NewManager(cfg.AllowedRoots, cfg.DataDir)
	if err != nil {
		return nil, err
	}
	snapshotManager := snapshots.New(cfg.DataDir)
	s := &Server{cfg: cfg, logger: logger, docker: dockerapi.New("/var/run/docker.sock"), services: services.New(), files: fm, processes: systemadmin.NewProcessManager(), ssh: sshadmin.New(cfg.DataDir), tasks: tasks.New(cfg.DataDir), snapshots: snapshotManager, apt: aptadmin.New(cfg.DataDir, snapshotManager)}
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/health", s.health)
	mux.HandleFunc("/v1/docker/status", s.dockerStatus)
	mux.HandleFunc("/v1/docker/install", s.dockerInstall)
	mux.HandleFunc("/v1/docker/containers", s.dockerContainers)
	mux.HandleFunc("/v1/docker/stats", s.dockerStats)
	mux.HandleFunc("/v1/docker/action", s.dockerAction)
	mux.HandleFunc("/v1/docker/logs", s.dockerLogs)
	mux.HandleFunc("/v1/docker/inspect", s.dockerInspect)
	mux.HandleFunc("/v1/docker/recreate", s.dockerRecreate)
	mux.HandleFunc("/v1/docker/images", s.dockerImages)
	mux.HandleFunc("/v1/docker/images/pull", s.dockerImagePull)
	mux.HandleFunc("/v1/docker/images/delete", s.dockerImageDelete)
	mux.HandleFunc("/v1/docker/networks", s.dockerNetworks)
	mux.HandleFunc("/v1/docker/networks/create", s.dockerNetworkCreate)
	mux.HandleFunc("/v1/docker/networks/delete", s.dockerNetworkDelete)
	mux.HandleFunc("/v1/docker/volumes", s.dockerVolumes)
	mux.HandleFunc("/v1/docker/volumes/create", s.dockerVolumeCreate)
	mux.HandleFunc("/v1/docker/volumes/delete", s.dockerVolumeDelete)
	mux.HandleFunc("/v1/docker/cleanup/preview", s.dockerCleanupPreview)
	mux.HandleFunc("/v1/docker/cleanup", s.dockerCleanup)
	mux.HandleFunc("/v1/docker/compose", s.dockerCompose)
	mux.HandleFunc("/v1/docker/compose/action", s.dockerComposeAction)
	mux.HandleFunc("/v1/services", s.serviceList)
	mux.HandleFunc("/v1/services/action", s.serviceAction)
	mux.HandleFunc("/v1/services/logs", s.serviceLogs)
	mux.HandleFunc("/v1/logs/system", s.systemLogs)
	mux.HandleFunc("/v1/processes", s.processList)
	mux.HandleFunc("/v1/processes/action", s.processAction)
	mux.HandleFunc("/v1/network", s.networkInfo)
	mux.HandleFunc("/v1/storage", s.storageInfo)
	mux.HandleFunc("/v1/timers", s.timerInfo)
	mux.HandleFunc("/v1/tasks", s.taskList)
	mux.HandleFunc("/v1/tasks/create", s.taskCreate)
	mux.HandleFunc("/v1/tasks/action", s.taskAction)
	mux.HandleFunc("/v1/updates", s.updateInfo)
	mux.HandleFunc("/v1/files", s.fileList)
	mux.HandleFunc("/v1/files/content", s.fileContent)
	mux.HandleFunc("/v1/files/create", s.fileCreate)
	mux.HandleFunc("/v1/files/mkdir", s.fileMkdir)
	mux.HandleFunc("/v1/files/rename", s.fileRename)
	mux.HandleFunc("/v1/files/delete", s.fileDelete)
	mux.HandleFunc("/v1/files/download", s.fileDownload)
	mux.HandleFunc("/v1/files/upload", s.fileUpload)
	mux.HandleFunc("/v1/files/archive/extract", s.fileArchiveExtract)
	mux.HandleFunc("/v1/files/copy", s.fileCopy)
	mux.HandleFunc("/v1/files/move", s.fileMove)
	mux.HandleFunc("/v1/files/chmod", s.fileChmod)
	mux.HandleFunc("/v1/files/recycle", s.fileRecycle)
	mux.HandleFunc("/v1/files/backups", s.fileBackups)
	mux.HandleFunc("/v1/files/backups/diff", s.fileBackupDiff)
	mux.HandleFunc("/v1/files/backups/restore", s.fileBackupRestore)
	mux.HandleFunc("/v1/ssh/status", s.sshStatus)
	mux.HandleFunc("/v1/ssh/users", s.sshUsers)
	mux.HandleFunc("/v1/ssh/keys", s.sshKeys)
	mux.HandleFunc("/v1/ssh/keys/add", s.sshKeyAdd)
	mux.HandleFunc("/v1/ssh/keys/delete", s.sshKeyDelete)
	mux.HandleFunc("/v1/ssh/keys/generate", s.sshKeyGenerate)
	mux.HandleFunc("/v1/ssh/password", s.sshPassword)
	mux.HandleFunc("/v1/security/status", s.securityStatus)
	mux.HandleFunc("/v1/security/fail2ban/install", s.fail2banInstall)
	mux.HandleFunc("/v1/security/auto-updates/enable", s.autoUpdatesEnable)
	mux.HandleFunc("/v1/snapshots", s.snapshotHandler)
	mux.HandleFunc("/v1/apt/preflight", s.aptPreflight)
	mux.HandleFunc("/v1/apt/search", s.aptSearch)
	mux.HandleFunc("/v1/apt/download", s.aptDownload)
	mux.HandleFunc("/v1/apt/upgrade", s.aptUpgrade)
	mux.HandleFunc("/v1/apt/package", s.aptPackage)
	mux.HandleFunc("/v1/docker/compose/config", s.dockerComposeConfig)
	mux.HandleFunc("/v1/docker/images/build", s.dockerImageBuild)
	mux.HandleFunc("/v1/files/search", s.fileSearch)
	mux.HandleFunc("/v1/files/preview", s.filePreview)
	mux.HandleFunc("/v1/files/preview/raw", s.filePreviewRaw)
	mux.HandleFunc("/v1/files/archive/list", s.fileArchiveList)
	mux.HandleFunc("/v1/files/archive/create", s.fileArchiveCreate)
	mux.HandleFunc("/v1/ssh/settings", s.sshSettings)
	mux.HandleFunc("/v1/ssh/port/confirm", s.sshPortConfirm)
	mux.HandleFunc("/v1/host/settings", s.hostSettings)
	mux.HandleFunc("/v1/host/hostname", s.hostHostname)
	mux.HandleFunc("/v1/host/timezone", s.hostTimezone)
	mux.HandleFunc("/v1/host/dns", s.hostDNS)
	mux.HandleFunc("/v1/host/swap", s.hostSwap)
	mux.HandleFunc("/v1/host/sysctl", s.hostSysctl)
	s.http = &http.Server{Handler: s.authenticate(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 35 * time.Minute, WriteTimeout: 35 * time.Minute, IdleTimeout: 60 * time.Second}
	return s, nil
}

func (s *Server) ListenAndServe() error {
	if err := os.MkdirAll(filepath.Dir(s.cfg.AgentSocket), 0o750); err != nil {
		return err
	}
	_ = os.Remove(s.cfg.AgentSocket)
	listener, err := net.Listen("unix", s.cfg.AgentSocket)
	if err != nil {
		return err
	}
	if err := os.Chmod(s.cfg.AgentSocket, 0o660); err != nil {
		listener.Close()
		return err
	}
	s.logger.Info("LukePanel agent listening", "socket", s.cfg.AgentSocket)
	err = s.http.Serve(listener)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		provided := r.Header.Get("X-LukePanel-Agent-Secret")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(s.cfg.AgentSecret)) != 1 {
			writeError(w, http.StatusUnauthorized, "agent authentication failed")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}
func (s *Server) dockerStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, s.docker.Status(r.Context()))
}
func (s *Server) dockerInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	result, err := hostadmin.InstallDocker(r.Context())
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error(), "output": result.Output})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) dockerContainers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.docker.ListContainers(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"containers": items})
}
func (s *Server) dockerStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	ids := r.URL.Query()["id"]
	items, err := s.docker.ContainerStats(r.Context(), ids)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"stats": items})
}
func (s *Server) dockerAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ ID, Action string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.docker.Action(r.Context(), req.ID, req.Action); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) dockerLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	logs, err := s.docker.Logs(r.Context(), r.URL.Query().Get("id"), parseInt(r.URL.Query().Get("tail"), 300))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"logs": logs})
}

func (s *Server) dockerInspect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	spec, err := s.docker.InspectContainer(r.Context(), r.URL.Query().Get("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, spec)
}

func (s *Server) dockerRecreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req dockerapi.RecreateRequest
	if decodeJSON(w, r, 2<<20, &req) != nil {
		return
	}
	result, err := s.docker.RecreateContainer(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) dockerImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.docker.ListImages(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"images": items})
}
func (s *Server) dockerImagePull(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Reference string `json:"reference"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	output, err := s.docker.PullImage(r.Context(), req.Reference)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": output})
}
func (s *Server) dockerImageDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.docker.RemoveImage(r.Context(), req.ID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) dockerNetworks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.docker.ListNetworks(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"networks": items})
}
func (s *Server) dockerNetworkCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Name     string `json:"name"`
		Driver   string `json:"driver"`
		Subnet   string `json:"subnet"`
		Gateway  string `json:"gateway"`
		Internal bool   `json:"internal"`
	}
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	network, err := s.docker.CreateNetwork(r.Context(), req.Name, req.Driver, req.Subnet, req.Gateway, req.Internal)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, network)
}
func (s *Server) dockerNetworkDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.docker.RemoveNetwork(r.Context(), req.ID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) dockerVolumes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.docker.ListVolumes(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"volumes": items})
}
func (s *Server) dockerVolumeCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Name   string `json:"name"`
		Driver string `json:"driver"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	volume, err := s.docker.CreateVolume(r.Context(), req.Name, req.Driver)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, volume)
}

func (s *Server) dockerCleanupPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	preview, err := s.docker.CleanupPreview(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, preview)
}

func (s *Server) dockerCleanup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Mode           string `json:"mode"`
		IncludeVolumes bool   `json:"include_volumes"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	result, err := s.docker.Cleanup(r.Context(), req.Mode, req.IncludeVolumes)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}
func (s *Server) dockerVolumeDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.docker.RemoveVolume(r.Context(), req.Name); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) dockerCompose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	projects, err := s.docker.ComposeProjects(r.Context())
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}
func (s *Server) dockerComposeAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Project, Action string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	output, err := s.docker.ComposeAction(r.Context(), req.Project, req.Action)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": output})
}

func (s *Server) serviceList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.services.List(r.Context(), r.URL.Query().Get("query"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"services": items})
}
func (s *Server) serviceAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Name, Action string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.services.Action(r.Context(), req.Name, req.Action); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) serviceLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	logs, err := s.services.Logs(r.Context(), r.URL.Query().Get("name"), parseInt(r.URL.Query().Get("lines"), 300))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"logs": logs})
}
func (s *Server) systemLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	logs, err := s.services.SystemLogs(r.Context(), r.URL.Query().Get("unit"), r.URL.Query().Get("priority"), parseInt(r.URL.Query().Get("lines"), 300))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"logs": logs})
}

func (s *Server) processList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.processes.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"processes": items})
}
func (s *Server) processAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		PID    int    `json:"pid"`
		Signal string `json:"signal"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.processes.Signal(req.PID, req.Signal); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) networkInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	data, err := systemadmin.Network(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, data)
}
func (s *Server) storageInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	data, err := systemadmin.Storage()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"mounts": data})
}
func (s *Server) timerInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	data, err := systemadmin.Timers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"timers": data})
}

func (s *Server) taskList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.tasks.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tasks": items})
}

func (s *Server) taskCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req tasks.CreateRequest
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	task, err := s.tasks.Create(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) taskAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		ID     string `json:"id"`
		Action string `json:"action"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.tasks.Action(r.Context(), req.ID, req.Action); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) updateInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	data, err := systemadmin.CheckUpdates(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, data)
}
func (s *Server) fileList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	listing, err := s.files.List(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, listing)
}
func (s *Server) fileContent(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		content, err := s.files.Read(r.URL.Query().Get("path"))
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, content)
	case http.MethodPut:
		var req struct{ Path, Content string }
		if decodeJSON(w, r, filemanager.MaxEditableSize+(64<<10), &req) != nil {
			return
		}
		if err := s.files.Write(req.Path, req.Content); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}
func (s *Server) fileCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Path string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.files.CreateFile(req.Path); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) fileMkdir(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Path string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.files.Mkdir(req.Path); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) fileRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Source, Destination string }
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	if err := s.files.Rename(req.Source, req.Destination); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) fileDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Path string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	destination, err := s.files.Trash(req.Path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"recycle_path": destination})
}
func (s *Server) fileCopy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Source, Destination string }
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	if err := s.files.Copy(req.Source, req.Destination); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) fileMove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Source, Destination string }
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	if err := s.files.Move(req.Source, req.Destination); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) fileChmod(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ Path, Mode string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.files.Chmod(req.Path, req.Mode); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) fileRecycle(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		entries, err := s.files.ListRecycle()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
	case http.MethodPost:
		var req struct{ ID, Action, Destination string }
		if decodeJSON(w, r, 16<<10, &req) != nil {
			return
		}
		switch req.Action {
		case "restore":
			path, err := s.files.RestoreRecycle(req.ID, req.Destination)
			if err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"path": path})
		case "purge":
			if err := s.files.PurgeRecycle(req.ID); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		default:
			writeError(w, http.StatusBadRequest, "不支持的回收站操作")
		}
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) fileBackups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	versions, err := s.files.ListBackups(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"versions": versions})
}

func (s *Server) fileBackupDiff(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	diff, err := s.files.BackupDiff(r.URL.Query().Get("path"), r.URL.Query().Get("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, diff)
}

func (s *Server) fileBackupRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Path string `json:"path"`
		ID   string `json:"id"`
	}
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	if err := s.files.RestoreBackup(req.Path, req.ID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) fileDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	f, info, err := s.files.OpenDownload(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename=%q`, info.Name()))
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	_, _ = io.Copy(w, f)
}
func (s *Server) fileUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, filemanager.MaxUploadSize+(2<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "上传请求格式错误或文件过大")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "缺少上传文件")
		return
	}
	defer file.Close()
	relativePath := strings.TrimSpace(r.FormValue("relative_path"))
	if relativePath == "" {
		relativePath = filepath.Base(header.Filename)
	}
	overwrite := r.FormValue("overwrite") == "1" || strings.EqualFold(r.FormValue("overwrite"), "true")
	path, err := s.files.SaveUploadRelative(r.FormValue("directory"), relativePath, file, filemanager.MaxUploadSize, overwrite)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": path})
}

func (s *Server) fileArchiveExtract(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, filemanager.MaxUploadSize+(2<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "压缩包请求格式错误或文件过大")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "缺少 ZIP 压缩包")
		return
	}
	defer file.Close()
	overwrite := r.FormValue("overwrite") == "1" || strings.EqualFold(r.FormValue("overwrite"), "true")
	result, err := s.files.ExtractZIP(r.FormValue("directory"), file, overwrite)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) sshStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, s.ssh.Status(r.Context()))
}
func (s *Server) sshUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	users, err := s.ssh.Users()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}
func (s *Server) sshKeys(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	keys, err := s.ssh.Keys(r.URL.Query().Get("user"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": keys})
}
func (s *Server) sshKeyAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ User, Key string }
	if decodeJSON(w, r, 1<<20, &req) != nil {
		return
	}
	key, err := s.ssh.AddKey(req.User, req.Key)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, key)
}
func (s *Server) sshKeyDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct{ User, ID string }
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	if err := s.ssh.DeleteKey(req.User, req.ID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) sshKeyGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		User       string `json:"user"`
		Comment    string `json:"comment"`
		Passphrase string `json:"passphrase"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	key, err := s.ssh.GenerateKey(r.Context(), req.User, req.Comment, req.Passphrase)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, key)
}

func (s *Server) sshPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	if err := s.ssh.SetPasswordAuthentication(r.Context(), req.Enabled); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) securityStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Listen       string `json:"listen"`
		SecureCookie bool   `json:"secure_cookie"`
		TOTPEnabled  bool   `json:"totp_enabled"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	cfg := s.cfg
	cfg.Listen = req.Listen
	cfg.SecureCookie = req.SecureCookie
	if req.TOTPEnabled {
		cfg.TOTPSecret = "enabled"
	} else {
		cfg.TOTPSecret = ""
	}
	writeJSON(w, http.StatusOK, hostadmin.SecurityStatus(r.Context(), cfg, s.ssh.Status(r.Context())))
}

func (s *Server) autoUpdatesEnable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	result, err := hostadmin.EnableAutomaticUpdates(r.Context())
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error(), "output": result.Output})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) fail2banInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		CurrentIP string `json:"current_ip"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	result, err := hostadmin.InstallFail2Ban(r.Context(), req.CurrentIP)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error(), "output": result.Output})
		return
	}
	writeJSON(w, http.StatusOK, result)
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
	writeJSON(w, status, map[string]string{"error": strings.TrimSpace(message)})
}
func methodNotAllowed(w http.ResponseWriter) {
	writeError(w, http.StatusMethodNotAllowed, "方法不允许")
}

func (s *Server) snapshotHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := s.snapshots.List()
		if err != nil {
			writeError(w, 500, err.Error())
			return
		}
		writeJSON(w, 200, map[string]any{"snapshots": items})
	case http.MethodPost:
		var req struct{ Action, ID string }
		if decodeJSON(w, r, 16<<10, &req) != nil {
			return
		}
		switch req.Action {
		case "restore":
			item, err := s.snapshots.Restore(req.ID)
			if err != nil {
				writeError(w, 400, err.Error())
				return
			}
			writeJSON(w, 200, item)
		case "delete":
			if err := s.snapshots.Delete(req.ID); err != nil {
				writeError(w, 400, err.Error())
				return
			}
			writeJSON(w, 200, map[string]bool{"ok": true})
		default:
			writeError(w, 400, "不支持的快照操作")
		}
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) aptPreflight(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	data, err := s.apt.Preflight(r.Context())
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, data)
}
func (s *Server) aptSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := s.apt.Search(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"packages": items})
}
func (s *Server) aptDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	result, err := s.apt.Download(r.Context())
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error(), "result": result})
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) aptUpgrade(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	result, err := s.apt.Upgrade(r.Context())
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error(), "result": result})
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) aptPackage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Action   string   `json:"action"`
		Packages []string `json:"packages"`
	}
	if decodeJSON(w, r, 64<<10, &req) != nil {
		return
	}
	var result aptadmin.Result
	var err error
	if req.Action == "install" {
		result, err = s.apt.Install(r.Context(), req.Packages)
	} else if req.Action == "remove" {
		result, err = s.apt.Remove(r.Context(), req.Packages)
	} else {
		writeError(w, 400, "不支持的软件包操作")
		return
	}
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error(), "result": result})
		return
	}
	writeJSON(w, 200, result)
}

func (s *Server) dockerComposeConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		config, err := s.docker.ReadComposeConfig(r.Context(), r.URL.Query().Get("project"))
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		writeJSON(w, 200, config)
	case http.MethodPut:
		var req dockerapi.ComposeSaveRequest
		if decodeJSON(w, r, 5<<20, &req) != nil {
			return
		}
		project, err := s.docker.ComposeProject(r.Context(), req.Project)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		snapshot, err := s.snapshots.Create("compose", "Compose 保存前: "+project.Name, "", project.ConfigFiles)
		if err != nil {
			writeError(w, 400, "创建快照失败: "+err.Error())
			return
		}
		output, err := s.docker.WriteComposeConfig(r.Context(), req)
		if err != nil {
			_, _ = s.snapshots.Restore(snapshot.ID)
			writeJSON(w, 400, map[string]any{"error": err.Error(), "output": output, "snapshot_id": snapshot.ID})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true, "output": output, "snapshot_id": snapshot.ID})
	default:
		methodNotAllowed(w)
	}
}
func (s *Server) dockerImageBuild(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req dockerapi.ImageBuildRequest
	if decodeJSON(w, r, 64<<10, &req) != nil {
		return
	}
	if _, _, err := s.files.ResolveExisting(req.ContextDir, true); err != nil {
		writeError(w, 400, "构建目录不在文件管理授权范围内: "+err.Error())
		return
	}
	result, err := s.docker.BuildImage(r.Context(), req)
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error(), "result": result})
		return
	}
	writeJSON(w, 200, result)
}

func (s *Server) fileSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	result, err := s.files.Search(r.URL.Query().Get("root"), r.URL.Query().Get("q"))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) filePreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	result, err := s.files.PreviewInfo(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) filePreviewRaw(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	file, info, mimeType, err := s.files.OpenPreview(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	defer file.Close()
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename=%q`, info.Name()))
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	_, _ = io.Copy(w, file)
}
func (s *Server) fileArchiveList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	result, err := s.files.ListZIP(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) fileArchiveCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req filemanager.ArchiveCreateRequest
	if decodeJSON(w, r, 128<<10, &req) != nil {
		return
	}
	result, err := s.files.CreateArchive(req)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}

func (s *Server) sshSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req sshadmin.SettingsRequest
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	_, _ = s.snapshots.Create("ssh", "SSH 高级设置前", "", []string{"/etc/ssh/sshd_config", "/etc/ssh/sshd_config.d"})
	result, err := s.ssh.ApplySettings(r.Context(), req)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}
func (s *Server) sshPortConfirm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		KeepNew bool `json:"keep_new"`
	}
	if decodeJSON(w, r, 8<<10, &req) != nil {
		return
	}
	result, err := s.ssh.ConfirmPort(r.Context(), req.KeepNew)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, result)
}

func (s *Server) hostSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, 200, hostadmin.ReadHostSettings(r.Context()))
}
func (s *Server) hostHostname(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Hostname string `json:"hostname"`
	}
	if decodeJSON(w, r, 8<<10, &req) != nil {
		return
	}
	_, _ = s.snapshots.Create("system", "修改主机名前", "", []string{"/etc/hostname", "/etc/hosts"})
	if err := hostadmin.SetHostname(r.Context(), req.Hostname); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
func (s *Server) hostTimezone(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		Timezone string `json:"timezone"`
	}
	if decodeJSON(w, r, 8<<10, &req) != nil {
		return
	}
	_, _ = s.snapshots.Create("system", "修改时区前", "", []string{"/etc/timezone", "/etc/localtime"})
	if err := hostadmin.SetTimezone(r.Context(), req.Timezone); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
func (s *Server) hostDNS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req hostadmin.DNSRequest
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	snapshot, _ := s.snapshots.Create("network", "修改 DNS 前", "", []string{"/etc/systemd/resolved.conf.d", "/etc/resolv.conf"})
	if err := hostadmin.SetDNS(r.Context(), req); err != nil {
		if snapshot.ID != "" {
			_, _ = s.snapshots.Restore(snapshot.ID)
		}
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
func (s *Server) hostSwap(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var req hostadmin.SwapRequest
		if decodeJSON(w, r, 8<<10, &req) != nil {
			return
		}
		_, _ = s.snapshots.Create("system", "创建 Swap 前", "", []string{"/etc/fstab"})
		status, err := hostadmin.CreateSwap(r.Context(), req)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		writeJSON(w, 200, status)
	case http.MethodDelete:
		_, _ = s.snapshots.Create("system", "删除 Swap 前", "", []string{"/etc/fstab"})
		if err := hostadmin.DeleteManagedSwap(r.Context()); err != nil {
			writeError(w, 400, err.Error())
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}
func (s *Server) hostSysctl(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req hostadmin.SysctlRequest
	if decodeJSON(w, r, 8<<10, &req) != nil {
		return
	}
	snapshot, _ := s.snapshots.Create("system", "应用 sysctl 前", "", []string{"/etc/sysctl.d/99-lukepanel.conf"})
	if err := hostadmin.ApplySysctlPreset(r.Context(), req); err != nil {
		if snapshot.ID != "" {
			_, _ = s.snapshots.Restore(snapshot.ID)
		}
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
