SHELL := /bin/bash
VERSION ?= dev
GITHUB_OAUTH_CLIENT_ID ?=
NPM ?= npm
LDFLAGS := -s -w -X main.version=$(VERSION) -X main.githubOAuthClientID=$(GITHUB_OAUTH_CLIENT_ID)

.PHONY: build frontend frontend-install frontend-check test clean

frontend-install:
	cd frontend && $(NPM) install --no-package-lock --no-audit --no-fund

frontend-check:
	cd frontend && $(NPM) run check

frontend:
	cd frontend && $(NPM) run build
	rm -rf internal/server/webdist
	mkdir -p internal/server/webdist/assets
	cp -a frontend/dist/. internal/server/webdist/
	cp -a web/assets/. internal/server/webdist/assets/
	cp web/manifest.webmanifest internal/server/webdist/manifest.webmanifest

build: frontend
	mkdir -p dist
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o dist/lukepanel ./cmd/lukepanel

test: frontend-check frontend
	go test ./...

clean:
	rm -rf dist frontend/dist frontend/node_modules internal/server/webdist
	mkdir -p internal/server/webdist
	touch internal/server/webdist/.gitkeep
