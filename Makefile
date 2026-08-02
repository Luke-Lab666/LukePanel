SHELL := /bin/bash
VERSION ?= $(shell tr -d '\r\n' < VERSION)
GITHUB_OAUTH_CLIENT_ID ?=
LDFLAGS := -s -w -X main.version=$(VERSION) -X main.githubOAuthClientID=$(GITHUB_OAUTH_CLIENT_ID)

.PHONY: frontend frontend-sync build test verify browser-test clean

frontend:
	./scripts/build-frontend.sh

frontend-sync:
	rm -rf internal/server/webdist
	mkdir -p internal/server/webdist
	cp -a web/. internal/server/webdist/
	diff -qr web internal/server/webdist

build: frontend
	mkdir -p dist
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o dist/lukepanel ./cmd/lukepanel

test:
	go test ./...

verify: frontend
	go test ./...
	go vet ./...
	diff -qr web internal/server/webdist
	python3 tests/static/validate.py

browser-test: frontend
	python3 tests/browser/audit.py
	python3 tests/browser/accessibility.py
	python3 tests/browser/truth_all.py

clean:
	rm -rf dist web internal/server/webdist frontend/dist reports/screenshots reports/browser-report.json
