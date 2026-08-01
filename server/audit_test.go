//go:build ignore
// +build ignore

// This compatibility stub neutralizes a file that an older ZIP importer could
// place at the repository root after incorrectly stripping the internal/
// directory. The real implementation lives in internal/server.
package server
