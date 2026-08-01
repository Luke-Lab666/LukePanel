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

	"github.com/Luke-Lab666/LukePanel/internal/config"
	"github.com/Luke-Lab666/LukePanel/internal/dockerapi"
	filemanager "github.com/Luke-Lab666/LukePanel/internal/files"
	"github.com/Luke-Lab666/LukePanel/internal/services"
	"github.com/Luke-Lab666/LukePanel/internal/sshadmin"
	"github.com/Luke-Lab666/LukePanel/internal/systemadmin"
)

type Server struct {
	cfg       config.Config
	logger    *slog.Logger
	docker    *dockerapi.Client
	services  *services.Manager
	files     *filemanager.Manager
	processes *systemadmin.ProcessManager
	ssh       *sshadmin.Manager
	http      *http.Server
}

func NewServer(cfg config.Config, logger *slog.Logger) (*Server, error) {
	fm, err := filemanager.NewManager(cfg.AllowedRoots, cfg.DataDir)
	if err != nil {
		return nil, err
	}
	s := &Server{cfg: cfg, logger: logger, docker: dockerapi.New("/var/run/docker.sock"), services: services.New(), files: fm, processes: systemadmin.NewProcessManager(), ssh: sshadmin.New(cfg.DataDir)}
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/health", s.health)
	mux.HandleFunc("/v1/docker/status", s.dockerStatus)
	mux.HandleFunc("/v1/docker/containers", s.dockerContainers)
	mux.HandleFunc("/v1/docker/action", s.dockerAction)
	mux.HandleFunc("/v1/docker/logs", s.dockerLogs)
	mux.HandleFunc("/v1/docker/images", s.dockerImages)
	mux.HandleFunc("/v1/docker/images/pull", s.dockerImagePull)
	mux.HandleFunc("/v1/docker/images/delete", s.dockerImageDelete)
	mux.HandleFunc("/v1/docker/networks", s.dockerNetworks)
	mux.HandleFunc("/v1/docker/networks/delete", s.dockerNetworkDelete)
	mux.HandleFunc("/v1/docker/volumes", s.dockerVolumes)
	mux.HandleFunc("/v1/docker/volumes/delete", s.dockerVolumeDelete)
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
	mux.HandleFunc("/v1/updates", s.updateInfo)
	mux.HandleFunc("/v1/files", s.fileList)
	mux.HandleFunc("/v1/files/content", s.fileContent)
	mux.HandleFunc("/v1/files/create", s.fileCreate)
	mux.HandleFunc("/v1/files/mkdir", s.fileMkdir)
	mux.HandleFunc("/v1/files/rename", s.fileRename)
	mux.HandleFunc("/v1/files/delete", s.fileDelete)
	mux.HandleFunc("/v1/files/download", s.fileDownload)
	mux.HandleFunc("/v1/files/upload", s.fileUpload)
	mux.HandleFunc("/v1/files/copy", s.fileCopy)
	mux.HandleFunc("/v1/files/move", s.fileMove)
	mux.HandleFunc("/v1/files/chmod", s.fileChmod)
	mux.HandleFunc("/v1/files/recycle", s.fileRecycle)
	mux.HandleFunc("/v1/ssh/status", s.sshStatus)
	mux.HandleFunc("/v1/ssh/users", s.sshUsers)
	mux.HandleFunc("/v1/ssh/keys", s.sshKeys)
	mux.HandleFunc("/v1/ssh/keys/add", s.sshKeyAdd)
	mux.HandleFunc("/v1/ssh/keys/delete", s.sshKeyDelete)
	s.http = &http.Server{Handler: s.authenticate(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Minute, WriteTimeout: 10 * time.Minute, IdleTimeout: 60 * time.Second}
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
	r.Body = http.MaxBytesReader(w, r.Body, filemanager.MaxUploadSize+(1<<20))
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
	path, err := s.files.SaveUpload(r.FormValue("directory"), filepath.Base(header.Filename), file, filemanager.MaxUploadSize)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": path})
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
