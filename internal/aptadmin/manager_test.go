package aptadmin

import "testing"

func TestParseSimulation(t *testing.T) {
	input := `Inst openssl [1.0] (1.1 Debian:stable [amd64])
Inst curl (8.0 Debian:stable [amd64])
Remv old-package [1.0]
Need to get 12.5 MB of archives.
After this operation, 3,072 kB of additional disk space will be used.`
	result := parseSimulation(input)
	if result.UpgradeCount != 2 || result.RemoveCount != 1 {
		t.Fatalf("unexpected: %+v", result)
	}
	if result.DownloadBytes < 12_000_000 {
		t.Fatalf("download: %d", result.DownloadBytes)
	}
	if result.DiskDeltaBytes < 3_000_000 {
		t.Fatalf("delta: %d", result.DiskDeltaBytes)
	}
}

func TestValidatePackages(t *testing.T) {
	if _, err := validatePackages([]string{"curl", "openssl:amd64"}); err != nil {
		t.Fatal(err)
	}
	if _, err := validatePackages([]string{"curl;rm"}); err == nil {
		t.Fatal("expected invalid")
	}
}
