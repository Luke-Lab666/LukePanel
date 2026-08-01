package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"

	"github.com/Luke-Lab666/LukePanel/internal/agent"
	"github.com/Luke-Lab666/LukePanel/internal/config"
	"github.com/Luke-Lab666/LukePanel/internal/server"
)

var version = "dev"

func main() {
	configPath := flag.String("config", envOr("LUKEPANEL_CONFIG", "/etc/lukepanel/config.json"), "configuration file")
	initOnly := flag.Bool("init", false, "initialize configuration and exit")
	agentMode := flag.Bool("agent", false, "run privileged local agent")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg, password, err := config.LoadOrCreate(*configPath)
	if err != nil {
		logger.Error("configuration failed", "error", err)
		os.Exit(1)
	}
	if password != "" {
		fmt.Printf("\nLukePanel initial credentials\nusername: %s\npassword: %s\nchange this password after first login\n\n", cfg.AdminUser, password)
	}
	if *initOnly {
		if password == "" {
			fmt.Printf("LukePanel configuration already exists: %s\n", *configPath)
		}
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
	srv, err := server.New(cfg, *configPath, version, logger)
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
