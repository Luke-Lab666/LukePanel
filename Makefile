SHELL := /bin/bash
VERSION ?= dev
GITHUB_OAUTH_CLIENT_ID ?=
LDFLAGS := -s -w -X main.version=$(VERSION) -X main.githubOAuthClientID=$(GITHUB_OAUTH_CLIENT_ID)

.PHONY: build frontend test clean
frontend:
	rm -rf internal/server/webdist
	mkdir -p internal/server/webdist
	cp -a web/. internal/server/webdist/

build: frontend
	mkdir -p dist
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o dist/lukepanel ./cmd/lukepanel

test:
	go test ./...

clean:
	rm -rf dist internal/server/webdist
