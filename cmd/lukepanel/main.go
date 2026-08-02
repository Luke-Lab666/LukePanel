package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/Luke-Lab666/LukePanel/internal/agent"
	"github.com/Luke-Lab666/LukePanel/internal/config"
	"github.com/Luke-Lab666/LukePanel/internal/server"
)

var (
	version             = "dev"
	githubOAuthClientID = ""
)

func main() {
	configPath := flag.String("config", envOr("LUKEPANEL_CONFIG", "/etc/lukepanel/config.json"), "configuration file")
	initOnly := flag.Bool("init", false, "initialize configuration and exit")
	initUser := flag.String("init-user", envOr("LUKEPANEL_INIT_USER", ""), "initial administrator username (first install only)")
	initPasswordFile := flag.String("init-password-file", "", "read initial administrator password from file (first install only)")
	initListen := flag.String("init-listen", envOr("LUKEPANEL_INIT_LISTEN", ""), "initial listen address (first install only)")
	agentMode := flag.Bool("agent", false, "run privileged local agent")
	showVersion := flag.Bool("version", false, "print version and exit")
	backupAuto := flag.Bool("backup-auto", false, "create a scheduled panel backup and exit")
	backupDir := flag.String("backup-dir", "", "scheduled backup directory")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	initialPassword := ""
	if *initPasswordFile != "" {
		raw, err := os.ReadFile(*initPasswordFile)
		if err != nil {
			logger.Error("read initial password file failed", "error", err)
			os.Exit(1)
		}
		initialPassword = strings.TrimRight(string(raw), "\r\n")
	}
	cfg, password, err := config.LoadOrCreateWithOptions(*configPath, config.InitOptions{
		AdminUser: *initUser,
		Password:  initialPassword,
		Listen:    *initListen,
	})
	if err != nil {
		logger.Error("configuration failed", "error", err)
		os.Exit(1)
	}
	if password != "" {
		if initialPassword != "" {
			fmt.Printf("\nLukePanel configuration initialized\nusername: %s\npassword: configured\n\n", cfg.AdminUser)
		} else {
			fmt.Printf("\nLukePanel initial credentials\nusername: %s\npassword: %s\nchange this password after first login\n\n", cfg.AdminUser, password)
		}
	}
	if *initOnly {
		if password == "" {
			fmt.Printf("LukePanel configuration already exists: %s\n", *configPath)
		}
		return
	}
	if *backupAuto {
		directory := *backupDir
		if directory == "" {
			directory = filepath.Join(cfg.DataDir, "scheduled-backups")
		}
		path, err := server.CreateScheduledPanelBackup(*configPath, cfg.DataDir, version, directory, 7)
		if err != nil {
			logger.Error("scheduled backup failed", "error", err)
			os.Exit(1)
		}
		fmt.Printf("LukePanel backup created: %s\n", path)
		return
	}
	if *agentMode {
		srv, err := agent.NewServer(cfg, logger)
		if err != nil {
			logger.Error("agent initialization failed", "error", err)
			os.Exit(1)
		}
		if err := srv.ListenAndServe(); err != nil {
			logger.Error("agent stopped", "error", err)
			os.Exit(1)
		}
		return
	}
	oauthClientID := strings.TrimSpace(githubOAuthClientID)
	if oauthClientID == "" {
		oauthClientID = strings.TrimSpace(os.Getenv("LUKEPANEL_GITHUB_CLIENT_ID"))
	}
	srv, err := server.New(cfg, *configPath, version, oauthClientID, logger)
	if err != nil {
		logger.Error("server initialization failed", "error", err)
		os.Exit(1)
	}
	if err := srv.ListenAndServe(); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
